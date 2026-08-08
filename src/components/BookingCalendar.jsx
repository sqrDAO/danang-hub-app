import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAmenityBookingRanges } from '../services/functions'
import { getDefaultAvailability, getDayAvailability } from '../services/amenities'
import { getBaseSlotStatus, getCellState } from '../utils/bookingRange'
import {
  addHubDays,
  formatHubDate,
  getHubDayOfMonth,
  getHubDayOfWeek,
  getHubStartOfDay,
  getHubStartOfToday,
  isSameHubDay,
  makeHubDateAtTime,
  toDateInputHub,
} from '../utils/timezone'
import { CalendarSkeleton } from './LoadingSkeleton'
import './BookingCalendar.css'

const CLICKABLE_CELL_STATUSES = new Set([
  'available',
  'range-start',
  'range-end',
  'range-selected',
  'range-end-candidate',
  'range-single',
])

// The calendar is always drawn in half-hour cells. Amenity slot duration is
// separate configuration and must not turn the visual time grid into points.
const CALENDAR_CELL_MINUTES = 30
const MOBILE_CAROUSEL_DAY_COUNT = 366

const ACTIVE_BOOKING_STATUSES = new Set(['pending', 'approved', 'checked-in'])

const CELL_TITLE_KEYS = {
  booked: 'calendar.booked',
  past: 'calendar.past',
  'range-blocked': 'calendar.rangeUnavailable',
  'range-end': 'calendar.endSelected',
  'range-end-candidate': 'calendar.adjustEndAt',
  'range-selected': 'calendar.shortenEndAt',
  'range-start': 'calendar.startSelected',
  'range-single': 'calendar.singleSelected',
  unavailable: 'calendar.closed',
}

const TIME_ROW_SIZES = {
  cell: 'var(--calendar-cell-height)',
  'cell-gap': 'var(--calendar-cell-gap)',
  'hour-guide': 'var(--calendar-guide-row-height)',
}

const TimeCell = ({ cell, onSelect, gridStyle }) => {
  const clickable = CLICKABLE_CELL_STATUSES.has(cell.status)

  return (
    <button
      type="button"
      className={`time-slot ${cell.status}`}
      style={gridStyle}
      onClick={clickable ? () => onSelect(cell.nextRange) : undefined}
      disabled={!clickable}
      title={cell.title}
      aria-label={cell.title}
    >
      {cell.marker && <span className="time-slot-marker">{cell.marker}</span>}
    </button>
  )
}

const getCellTitle = (status, time, t) => {
  const key = CELL_TITLE_KEYS[status]
  return key ? t(key, { time }) : t('calendar.availableAt', { time })
}

const getCellMarker = (status, cell) => {
  if (status === 'range-single' || status === 'range-start') return cell.time
  if (status === 'range-end') return cell.endTime
  return null
}

const isDateBeforeToday = (date) => getHubStartOfDay(date) < getHubStartOfToday()

const getMobileCarouselDates = () => {
  const startDate = getHubStartOfToday()
  return Array.from(
    { length: MOBILE_CAROUSEL_DAY_COUNT },
    (_, index) => addHubDays(startDate, index)
  )
}

const isSelectableDate = (date, availability) =>
  !isDateBeforeToday(date) && availability.availableDays.includes(getHubDayOfWeek(date))

// Weekday names for the availability label, taken from a known Sunday so the
// index maps straight onto `availableDays` (0 = Sunday). These are plain
// weekday names, so they are read in UTC rather than through the hub helpers.
const WEEKDAY_LABEL_DATES = Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2024, 0, 7 + day)))

const getWeekdayName = (day, locale) =>
  WEEKDAY_LABEL_DATES[day].toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })

const isContiguous = (days) =>
  days.every((day, index) => index === 0 || day === days[index - 1] + 1)

const getAvailableDaysLabel = (availableDays, locale) => {
  const days = [...new Set(availableDays)].sort((first, second) => first - second)
  if (days.length === 0 || days.length === 7) return ''
  const names = days.map(day => getWeekdayName(day, locale))
  return days.length >= 3 && isContiguous(days)
    ? `(${names[0]}–${names[names.length - 1]})`
    : `(${names.join(', ')})`
}

const getTimeParts = (totalMinutes) => {
  const hour = Math.floor(totalMinutes / 60)
  const minute = totalMinutes % 60
  return {
    hour,
    minute,
    time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
  }
}

const MobileDateSelector = ({
  dates,
  currentDate,
  availability,
  locale,
  t,
  onSelect,
  selectedDateRef,
}) => (
  <section className="mobile-date-selector" aria-labelledby="mobile-date-selector-title">
    <div className="mobile-date-selector-header">
      <div>
        <h4 id="mobile-date-selector-title">{t('memberBookings.modal.selectDateTitle')}</h4>
        <p>{t('memberBookings.modal.selectDateHint')}</p>
      </div>
    </div>

    <div className="mobile-date-carousel" aria-label={t('memberBookings.modal.selectDateTitle')}>
      {dates.map(date => {
        const selectable = isSelectableDate(date, availability)
        const selected = isSameHubDay(date, currentDate)
        const label = formatHubDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric' })
        return (
          <button
            key={date.toISOString()}
            ref={selected ? selectedDateRef : null}
            type="button"
            className={`mobile-date-option${selected ? ' selected' : ''}`}
            onClick={() => onSelect(date)}
            disabled={!selectable}
            aria-pressed={selected}
            aria-label={label}
          >
            <span className="mobile-date-option-weekday">{formatHubDate(date, locale, { weekday: 'short' })}</span>
            <span className="mobile-date-option-day">{getHubDayOfMonth(date)}</span>
            <span className="mobile-date-option-month">{formatHubDate(date, locale, { month: 'short' })}</span>
          </button>
        )
      })}
    </div>
  </section>
)

const MobileTimeHeader = ({ date, amenity, locale, t, onChangeDate }) => {
  const dayOfWeek = getHubDayOfWeek(date)
  const dayAvail = getDayAvailability(dayOfWeek, amenity)
  const startStr = dayAvail.startHour.toString().padStart(2, '0')
  const endStr = dayAvail.endHour.toString().padStart(2, '0')
  return (
    <div className="mobile-time-header">
      <div>
        <h4>{formatHubDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
        <p>{t('calendar.hours')} {startStr}:00 - {endStr}:00</p>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onChangeDate}>
        {t('memberBookings.modal.changeDate')}
      </button>
    </div>
  )
}

const getTimeCells = (availability) => {
  const cells = []
  const startMinutes = availability.startHour * 60
  const endMinutes = availability.endHour * 60
  for (let startMinutesOfDay = startMinutes; startMinutesOfDay < endMinutes; startMinutesOfDay += CALENDAR_CELL_MINUTES) {
    const start = getTimeParts(startMinutesOfDay)
    const end = getTimeParts(Math.min(startMinutesOfDay + CALENDAR_CELL_MINUTES, endMinutes))
    cells.push({
      hour: start.hour,
      minute: start.minute,
      time: start.time,
      endHour: end.hour,
      endMinute: end.minute,
      endTime: end.time,
    })
  }
  return cells
}

const getHourGroups = ({ startHour, endHour }) => {
  const groups = []
  for (let hour = startHour; hour < endHour; hour++) {
    groups.push({
      hour,
      label: getTimeParts(hour * 60).time,
    })
  }
  return groups
}

const buildTimeLayout = (hourGroups, timeCells) => {
  const rows = []
  const cellRows = []
  const labels = []
  const cellsByHour = new Map()

  timeCells.forEach((cell, index) => {
    const cells = cellsByHour.get(cell.hour) || []
    cells.push(index)
    cellsByHour.set(cell.hour, cells)
  })

  hourGroups.forEach(group => {
    rows.push({ type: 'hour-guide', key: `guide-${group.label}` })
    const groupStart = rows.length
    const cellsInGroup = cellsByHour.get(group.hour) || []

    cellsInGroup.forEach((index, cellIndex) => {
      rows.push({ type: 'cell' })
      cellRows[index] = rows.length
      if (cellIndex < cellsInGroup.length - 1) rows.push({ type: 'cell-gap' })
    })

    labels.push({
      label: group.label,
      rowStart: groupStart + 1,
      rowSpan: rows.length - groupStart,
    })

  })
  return { rows, cellRows, labels }
}

const getCalendarGridStyle = (dayCount, rows) => ({
  '--calendar-day-count': dayCount,
  '--calendar-time-rows': rows.map(({ type }) => TIME_ROW_SIZES[type]).join(' '),
})

const getWeekStart = (value) => {
  const day = getHubDayOfWeek(value)
  return addHubDays(value, -day + (day === 0 ? -6 : 1))
}

const getWeekDates = (weekStart) =>
  Array.from({ length: 7 }, (_, index) => addHubDays(weekStart, index))

const getEffectiveViewMode = (mobileMode, viewMode) => mobileMode ? 'day' : viewMode

const isMobileDateStage = (mobileMode, mobileStage) =>
  mobileMode && mobileStage === 'date'

const CalendarDateHeader = ({ date, locale }) => {
  const isToday = isSameHubDay(date, new Date())
  return (
    <div className={`calendar-date-header ${isToday ? 'today' : ''}`}>
      <div className="date-day-name">{formatHubDate(date, locale, { weekday: 'short' })}</div>
      <div className="date-day-number">{getHubDayOfMonth(date)}</div>
      <div className="date-month">{formatHubDate(date, locale, { month: 'short' })}</div>
    </div>
  )
}

const formatEventSpaceHours = (amenity, defaults, availableDays, locale) => {
  const weekdayStart = amenity?.weekdayStartHour ?? defaults.weekdayStartHour ?? 18
  const weekendStart = amenity?.startHour ?? defaults.startHour ?? 9
  const endHour = amenity?.endHour ?? defaults.endHour ?? 22
  const weekdays = availableDays.filter(day => day >= 1 && day <= 5)
  const weekends = availableDays.filter(day => day === 0 || day === 6)

  const hourRange = (start) => `${start.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`
  const ranges = []
  if (weekdays.length) ranges.push(`${hourRange(weekdayStart)} ${getAvailableDaysLabel(weekdays, locale)}`)
  if (weekends.length) ranges.push(`${hourRange(weekendStart)} ${getAvailableDaysLabel(weekends, locale)}`)

  return ranges.join(', ')
}

const getFormattedHoursInfo = (amenity, availability, locale) => {
  const defaults = availability.defaults || getDefaultAvailability(amenity?.type)
  const isEventSpace = amenity?.type === 'event-space' || defaults.weekdayStartHour !== undefined

  if (isEventSpace) {
    return formatEventSpaceHours(amenity, defaults, availability.availableDays, locale)
  }

  const start = availability.baseStartHour ?? availability.startHour
  const end = availability.baseEndHour ?? availability.endHour
  return `${start}:00 - ${end}:00 ${getAvailableDaysLabel(availability.availableDays, locale)}`
}

const CalendarHeader = ({
  mobileMode,
  currentDate,
  amenity,
  availability,
  effectiveViewMode,
  weekStart,
  locale,
  t,
  onPrevious,
  onToday,
  onNext,
  onChangeDate,
}) => {
  if (mobileMode) {
    return <MobileTimeHeader date={currentDate} amenity={amenity} availability={availability} locale={locale} t={t} onChangeDate={onChangeDate} />
  }

  return (
    <div className="calendar-header">
      <div className="calendar-nav">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onPrevious}>{t('calendar.prev')}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onToday}>{t('calendar.today')}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onNext}>{t('calendar.next')}</button>
      </div>
      <div className="calendar-title">
        {effectiveViewMode === 'week'
          ? formatHubDate(weekStart, locale, { month: 'long', year: 'numeric' })
          : formatHubDate(currentDate, locale, { month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      <div className="calendar-hours-info">
        {t('calendar.hours')} {getFormattedHoursInfo(amenity, availability, locale)}
      </div>
    </div>
  )
}

const CalendarError = ({ message, onRetry, t }) => (
  <div className="calendar-error" role="alert">
    <p className="calendar-error-message">
      {t('calendar.errorLoadingBookings', { message: message || t('calendar.unknownError') })}
    </p>
    <p className="calendar-error-hint">{t('calendar.errorSelectionBlocked')}</p>
    <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
      {t('calendar.retry')}
    </button>
  </div>
)

const getCalendarGridClassName = (mobileMode, disabled) =>
  `calendar-grid${mobileMode ? ' calendar-grid--mobile' : ''}${disabled ? ' calendar-grid--disabled' : ''}`

const CalendarGrid = ({
  mobileMode,
  disabled,
  gridStyle,
  dateSlots,
  locale,
  timeLayout,
  onSelect,
}) => (
  <div className={getCalendarGridClassName(mobileMode, disabled)} style={gridStyle}>
    {!mobileMode && (
      <div className="calendar-date-headers">
        {dateSlots.map(({ date, dayAvailable }) => (
          <div key={date.toISOString()} className={`calendar-date-column ${!dayAvailable ? 'unavailable-day' : ''}`}>
            <CalendarDateHeader date={date} locale={locale} />
          </div>
        ))}
      </div>
    )}

    <div className="calendar-time-grid">
      {timeLayout.labels.map(({ label, rowStart, rowSpan }) => (
        <div
          key={label}
          className="time-label"
          style={{ gridColumn: 1, gridRow: `${rowStart} / span ${rowSpan}` }}
        >
          {label}
        </div>
      ))}

      {timeLayout.rows.map((row, index) => row.type === 'hour-guide' && (
        <div
          key={row.key}
          className="calendar-hour-guide"
          style={{ gridColumn: '1 / -1', gridRow: index + 1 }}
          aria-hidden="true"
        />
      ))}

      {dateSlots.flatMap(({ date, cells }, dateIndex) =>
        cells.map((cell, cellIndex) => (
          <TimeCell
            key={`${date.toISOString()}-${cell.startMs}`}
            cell={cell}
            onSelect={onSelect}
            gridStyle={{ gridColumn: dateIndex + 2, gridRow: timeLayout.cellRows[cellIndex] }}
          />
        ))
      )}
    </div>
  </div>
)

const BookingCalendar = ({
  amenity,
  onRangeChange,
  selectedStartTime = null,
  selectedEndTime = null,
  selectedDate = null,
  onSelectedDateChange,
  viewMode = 'week',
  disabled = false,
  className = '',
  mobileMode = false,
  mobileStage = 'time',
  onMobileStageChange,
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [currentDate, setCurrentDate] = useState(
    () => getHubStartOfDay(selectedDate ?? new Date())
  )
  const selectedDateRef = useRef(null)
  const availability = useMemo(() => {
    const defaults = getDefaultAvailability(amenity?.type)
    const baseStartHour = amenity?.startHour ?? defaults.startHour
    const baseEndHour = amenity?.endHour ?? defaults.endHour
    const availableDays = amenity?.availableDays ?? defaults.availableDays

    let minStartHour = baseStartHour
    let maxEndHour = baseEndHour

    if (amenity?.type === 'event-space' || defaults.weekdayStartHour !== undefined) {
      const weekdayStart = amenity?.weekdayStartHour ?? defaults.weekdayStartHour ?? baseStartHour
      minStartHour = Math.min(baseStartHour, weekdayStart)
    }

    return {
      startHour: minStartHour,
      endHour: maxEndHour,
      availableDays,
      baseStartHour,
      baseEndHour,
      defaults,
    }
  }, [amenity])
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const timeCells = useMemo(() => getTimeCells(availability), [availability])
  const hourGroups = useMemo(() => getHourGroups(availability), [availability])
  const timeLayout = useMemo(() => buildTimeLayout(hourGroups, timeCells), [hourGroups, timeCells])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const effectiveViewMode = getEffectiveViewMode(mobileMode, viewMode)
  const showMobileDatePicker = isMobileDateStage(mobileMode, mobileStage)
  const displayDates = useMemo(
    () => (effectiveViewMode === 'week' ? weekDates : [currentDate]),
    [effectiveViewMode, weekDates, currentDate]
  )
  const carouselDates = useMemo(() => getMobileCarouselDates(), [])
  const bookingWindow = useMemo(() => ({
    startDate: addHubDays(weekStart, -7),
    endDate: new Date(addHubDays(weekStart, 15).getTime() - 1),
  }), [weekStart])
  // Keyed under 'bookings' so the mutations' invalidate('bookings') still
  // refreshes the grid after a booking is created or cancelled.
  const { data: allBookings = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bookings', 'ranges', amenity?.id, toDateInputHub(weekStart)],
    queryFn: () => getAmenityBookingRanges(
      amenity.id,
      bookingWindow.startDate,
      bookingWindow.endDate
    ),
    enabled: !!amenity?.id,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  useEffect(() => {
    if (showMobileDatePicker) {
      selectedDateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [currentDate, showMobileDatePicker])

  const dateSlots = useMemo(() => {
    const now = Date.now()
    const selection = {
      startMs: selectedStartTime ? new Date(selectedStartTime).getTime() : null,
      endMs: selectedEndTime ? new Date(selectedEndTime).getTime() : null,
    }
    const capacity = typeof amenity?.capacity === 'number' && amenity.capacity > 0 ? amenity.capacity : 1
    const isSharedDesk = amenity?.type === 'desk' && capacity > 1
    const bookingRanges = allBookings
      .filter(({ status }) => ACTIVE_BOOKING_STATUSES.has(status))
      .map(({ startTime, endTime }) => [new Date(startTime).getTime(), new Date(endTime).getTime()])

    return displayDates.map(date => {
      const dayOfWeek = getHubDayOfWeek(date)
      const dayAvail = getDayAvailability(dayOfWeek, amenity)
      const dayAvailable = dayAvail.isDayAvailable
      const context = {
        dayAvailable,
        dayStartHour: dayAvail.startHour,
        dayEndHour: dayAvail.endHour,
        now,
        bookingRanges,
        isSharedDesk,
        capacity,
      }
      const cells = timeCells.map(slot => {
        const key = makeHubDateAtTime(date, slot.hour, slot.minute).getTime()
        const endKey = makeHubDateAtTime(date, slot.endHour, slot.endMinute).getTime()
        return {
          ...slot,
          startMs: key,
          endMs: endKey,
          timeRange: `${slot.time}–${slot.endTime}`,
          baseStatus: getBaseSlotStatus({ ...slot, startMs: key, endMs: endKey }, context),
        }
      })
      return {
        date,
        dayAvailable,
        cells: cells.map(cell => {
          const state = getCellState(cell, selection, cells)
          return {
            ...cell,
            ...state,
            marker: getCellMarker(state.status, cell),
            title: getCellTitle(state.status, cell.timeRange, t),
          }
        }),
      }
    })
  }, [allBookings, amenity, displayDates, selectedEndTime, selectedStartTime, t, timeCells])

  const handleCellSelect = (nextRange) => {
    if (disabled || !nextRange) return
    onRangeChange?.({
      startTime: nextRange.startMs === null ? null : new Date(nextRange.startMs),
      endTime: nextRange.endMs === null ? null : new Date(nextRange.endMs),
    })
  }

  const handleMobileDateSelect = (date) => {
    if (selectedStartTime && !isSameHubDay(selectedStartTime, date)) {
      onRangeChange?.({ startTime: null, endTime: null })
    }
    setCurrentDate(date)
    onSelectedDateChange?.(date)
    onMobileStageChange?.('time')
  }

  const shiftCurrentDate = (direction) => {
    const step = effectiveViewMode === 'week' ? 7 : 1
    setCurrentDate(addHubDays(currentDate, direction * step))
  }

  if (showMobileDatePicker) {
    return (
      <div className={`booking-calendar booking-calendar--mobile-date-picker ${className}`.trim()}>
        <MobileDateSelector
          dates={carouselDates}
          currentDate={currentDate}
          availability={availability}
          locale={locale}
          t={t}
          onSelect={handleMobileDateSelect}
          selectedDateRef={selectedDateRef}
        />
      </div>
    )
  }

  if (isLoading) return <CalendarSkeleton />

  // Never fall back to an empty booking list: `allBookings = []` would paint
  // every cell as free, and neither `checkBookingConflicts` (advisory, returns
  // no-conflict on error) nor `firestore.rules` (no overlap check) would catch
  // the resulting double booking. Block selection instead.
  if (isError) return <CalendarError message={error?.message} onRetry={refetch} t={t} />

  const calendarGridStyle = getCalendarGridStyle(displayDates.length, timeLayout.rows)

  return (
    <div className={`booking-calendar ${className}`.trim()}>
      <CalendarHeader
        mobileMode={mobileMode}
        currentDate={currentDate}
        amenity={amenity}
        availability={availability}
        effectiveViewMode={effectiveViewMode}
        weekStart={weekStart}
        locale={locale}
        t={t}
        onPrevious={() => shiftCurrentDate(-1)}
        onToday={() => setCurrentDate(getHubStartOfToday())}
        onNext={() => shiftCurrentDate(1)}
        onChangeDate={() => onMobileStageChange?.('date')}
      />
      <CalendarGrid
        mobileMode={mobileMode}
        disabled={disabled}
        gridStyle={calendarGridStyle}
        dateSlots={dateSlots}
        locale={locale}
        timeLayout={timeLayout}
        onSelect={handleCellSelect}
      />

    </div>
  )
}

export default BookingCalendar
