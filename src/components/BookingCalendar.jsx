import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getBookings } from '../services/bookings'
import { DEFAULT_AVAILABILITY } from '../services/amenities'
import { getBaseSlotStatus, getCellState } from '../utils/bookingRange'
import { isLocalBookingDev } from '../utils/localBookingMode'
import { CalendarSkeleton } from './LoadingSkeleton'
import './BookingCalendar.css'

const CLICKABLE_CELL_STATUSES = new Set([
  'available',
  'range-start',
  'range-end',
  'range-selected',
  'range-end-candidate',
  'range-start-candidate',
  'range-single',
])

// The calendar is always drawn in half-hour cells. Amenity slot duration is
// separate configuration and must not turn the visual time grid into points.
const CALENDAR_CELL_MINUTES = 30

const CELL_TITLE_KEYS = {
  booked: 'calendar.booked',
  past: 'calendar.past',
  'range-blocked': 'calendar.rangeUnavailable',
  'range-end': 'calendar.endSelected',
  'range-end-candidate': 'calendar.adjustEndAt',
  'range-selected': 'calendar.adjustEndAt',
  'range-start': 'calendar.startSelected',
  'range-start-candidate': 'calendar.adjustStartAt',
  'range-single': 'calendar.singleSelected',
  unavailable: 'calendar.closed',
}

const CELL_MARKER_KEYS = {
  'range-end': 'calendar.endMarker',
  'range-single': 'calendar.singleMarker',
  'range-start': 'calendar.startMarker',
}

const TimeCell = ({ cell, onSelect, style }) => {
  const clickable = CLICKABLE_CELL_STATUSES.has(cell.status)

  return (
    <button
      type="button"
      className={`time-slot ${cell.status}`}
      style={style}
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

const makeDateAtTime = (date, hour, minute) => {
  const slotDate = new Date(date)
  slotDate.setHours(hour, minute, 0, 0)
  return slotDate.getTime()
}

const getTimeCells = (availability) => {
  const cells = []
  const startMinutes = availability.startHour * 60
  const endMinutes = availability.endHour * 60
  for (let minuteOfDay = startMinutes; minuteOfDay < endMinutes; minuteOfDay += CALENDAR_CELL_MINUTES) {
    const hour = Math.floor(minuteOfDay / 60)
    const minute = minuteOfDay % 60
    const cellEndMinutes = Math.min(minuteOfDay + CALENDAR_CELL_MINUTES, endMinutes)
    const endHour = Math.floor(cellEndMinutes / 60)
    const endMinute = cellEndMinutes % 60
    const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
    cells.push({ hour, minute, time, endHour, endMinute, endTime })
  }
  return cells
}

const getHourGroups = ({ startHour, endHour }) => {
  const groups = []
  for (let hour = startHour; hour < endHour; hour++) {
    groups.push({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
    })
  }
  return groups
}

const buildTimeLayout = (hourGroups, timeCells) => {
  const rows = []
  const cellRows = []
  const labels = []

  hourGroups.forEach((group, groupIndex) => {
    const groupStart = rows.length
    const cellsInGroup = timeCells.filter(cell => cell.hour === group.hour)

    cellsInGroup.forEach((cell, cellIndex) => {
      const timeCellIndex = timeCells.indexOf(cell)
      rows.push({ type: 'cell' })
      cellRows[timeCellIndex] = rows.length
      if (cellIndex < cellsInGroup.length - 1) rows.push({ type: 'cell-gap' })
    })

    labels.push({
      label: group.label,
      rowStart: groupStart + 1,
      rowSpan: rows.length - groupStart,
    })

    if (groupIndex < hourGroups.length - 1) {
      rows.push({ type: 'hour-guide', key: `guide-${group.label}` })
    }
  })

  return { rows, cellRows, labels }
}

const getWeekStart = (value) => {
  const date = new Date(value)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

const getWeekDates = (weekStart) => Array.from({ length: 7 }, (_, index) => {
  const date = new Date(weekStart)
  date.setDate(weekStart.getDate() + index)
  return date
})

const BookingCalendar = ({
  amenity,
  onRangeChange,
  selectedStartTime = null,
  selectedEndTime = null,
  viewMode = 'week',
  disabled = false,
}) => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isMobile, setIsMobile] = useState(false)
  const availability = useMemo(() => ({
    startHour: amenity?.startHour ?? DEFAULT_AVAILABILITY.startHour,
    endHour: amenity?.endHour ?? DEFAULT_AVAILABILITY.endHour,
    availableDays: amenity?.availableDays ?? DEFAULT_AVAILABILITY.availableDays,
  }), [amenity])
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate])
  const timeCells = useMemo(() => getTimeCells(availability), [availability])
  const hourGroups = useMemo(() => getHourGroups(availability), [availability])
  const timeLayout = useMemo(() => buildTimeLayout(hourGroups, timeCells), [hourGroups, timeCells])
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const effectiveViewMode = isMobile ? 'day' : viewMode
  const displayDates = useMemo(
    () => (effectiveViewMode === 'week' ? weekDates : [currentDate]),
    [effectiveViewMode, weekDates, currentDate]
  )
  const bookingWindow = useMemo(() => {
    const startDate = new Date(weekStart)
    startDate.setDate(startDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(weekStart)
    endDate.setDate(endDate.getDate() + 14)
    endDate.setHours(23, 59, 59, 999)
    return { startDate, endDate }
  }, [weekStart])
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['bookings', amenity?.id, weekStart.toISOString().split('T')[0]],
    queryFn: () => getBookings({ amenityId: amenity.id, ...bookingWindow }),
    enabled: !!amenity?.id && !isLocalBookingDev,
  })

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const dateSlots = useMemo(() => {
    const now = Date.now()
    const selection = {
      startMs: selectedStartTime ? new Date(selectedStartTime).getTime() : null,
      endMs: selectedEndTime ? new Date(selectedEndTime).getTime() : null,
    }
    const capacity = typeof amenity?.capacity === 'number' && amenity.capacity > 0 ? amenity.capacity : 1
    const isSharedDesk = amenity?.type === 'desk' && capacity > 1
    const bookingRanges = allBookings
      .filter(({ status }) => ['pending', 'approved', 'checked-in'].includes(status))
      .map(({ startTime, endTime }) => [new Date(startTime).getTime(), new Date(endTime).getTime()])

    return displayDates.map(date => {
      const dayAvailable = availability.availableDays.includes(date.getDay())
      const context = { dayAvailable, now, bookingRanges, isSharedDesk, capacity }
      const cells = timeCells.map(slot => {
        const key = makeDateAtTime(date, slot.hour, slot.minute)
        const endKey = makeDateAtTime(date, slot.endHour, slot.endMinute)
        return {
          ...slot,
          startMs: key,
          endMs: endKey,
          timeRange: `${slot.time}–${slot.endTime}`,
          baseStatus: getBaseSlotStatus({ startMs: key, endMs: endKey }, context),
        }
      })
      return {
        date,
        dayAvailable,
        cells: cells.map(cell => {
          const state = getCellState(cell, selection, cells)
          const markerKey = CELL_MARKER_KEYS[state.status]
          return {
            ...cell,
            ...state,
            marker: markerKey ? t(markerKey) : null,
            title: getCellTitle(state.status, cell.timeRange, t),
          }
        }),
      }
    })
  }, [allBookings, amenity?.capacity, amenity?.type, availability, displayDates, selectedEndTime, selectedStartTime, t, timeCells])

  const updateCurrentDate = (nextDate) => {
    setCurrentDate(nextDate)
  }

  const handleCellSelect = (nextRange) => {
    if (disabled || !nextRange) return
    onRangeChange?.({
      startTime: nextRange.startMs === null ? null : new Date(nextRange.startMs),
      endTime: nextRange.endMs === null ? null : new Date(nextRange.endMs),
    })
  }

  const handlePrevWeek = () => {
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + (effectiveViewMode === 'week' ? -7 : -1))
    updateCurrentDate(nextDate)
  }

  const handleNextWeek = () => {
    const nextDate = new Date(currentDate)
    nextDate.setDate(nextDate.getDate() + (effectiveViewMode === 'week' ? 7 : 1))
    updateCurrentDate(nextDate)
  }

  const formatDateHeader = (date, dayAvailable) => {
    const isToday = date.toDateString() === new Date().toDateString()
    return (
      <div className={`calendar-date-header ${isToday ? 'today' : ''} ${!dayAvailable ? 'weekend' : ''}`}>
        <div className="date-day-name">{date.toLocaleDateString(locale, { weekday: 'short' })}</div>
        <div className="date-day-number">{date.getDate()}</div>
        <div className="date-month">{date.toLocaleDateString(locale, { month: 'short' })}</div>
        {!dayAvailable && <div className="weekend-label">{t('calendar.closed')}</div>}
      </div>
    )
  }

  if (isLoading) return <CalendarSkeleton />

  const calendarGridStyle = {
    '--calendar-day-count': displayDates.length,
    '--calendar-time-rows': timeLayout.rows.map(row => {
      if (row.type === 'cell') return 'var(--calendar-cell-height)'
      if (row.type === 'cell-gap') return 'var(--calendar-grid-gap)'
      return 'var(--calendar-guide-space)'
    }).join(' '),
  }

  return (
    <div className="booking-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrevWeek}>{t('calendar.prev')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateCurrentDate(new Date())}>{t('calendar.today')}</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleNextWeek}>{t('calendar.next')}</button>
        </div>
        <div className="calendar-title">
          {effectiveViewMode === 'week'
            ? weekStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
            : currentDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="calendar-hours-info">
          {t('calendar.hours')} {availability.startHour}:00 - {availability.endHour}:00 {t('calendar.monFri')}
        </div>
      </div>

      <div className={`calendar-grid${disabled ? ' calendar-grid--disabled' : ''}`} style={calendarGridStyle}>
        <div className="calendar-date-headers">
          {dateSlots.map(({ date, dayAvailable }) => (
            <div key={date.toISOString()} className={`calendar-date-column ${!dayAvailable ? 'unavailable-day' : ''}`}>
              {formatDateHeader(date, dayAvailable)}
            </div>
          ))}
        </div>

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
              style={{ gridColumn: '2 / -1', gridRow: index + 1 }}
              aria-hidden="true"
            />
          ))}

          {dateSlots.flatMap(({ date, cells }, dateIndex) =>
            cells.map((cell, cellIndex) => (
              <TimeCell
                key={`${date.toISOString()}-${cell.startMs}`}
                cell={cell}
                onSelect={handleCellSelect}
                style={{ gridColumn: dateIndex + 2, gridRow: timeLayout.cellRows[cellIndex] }}
              />
            ))
          )}
        </div>
      </div>

    </div>
  )
}

export default BookingCalendar
