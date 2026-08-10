import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import BookingCalendar from '../../components/BookingCalendar'
import { showToast } from '../../utils/toast'
import { isPendingFor } from '../../utils/mutationTarget'
import { getBookings, updateBooking, deleteBooking, checkIn, checkOut, createBooking, createFixedDeskPlan } from '../../services/bookings'
import { getMembers } from '../../services/members'
import { getAmenities } from '../../services/amenities'
import { checkBookingConflictsStrict } from '../../services/functions'
import './Bookings.css'
import { formatDateDDMMYYYY } from '../../utils/timezone'

const PAGE_SIZE = 10

// Admin "view all" intent — fetch a generous ±365 day window rather than
// the entire bookings collection (which is unbounded over time).
const getAdminBookingsWindow = () => {
  const start = new Date()
  start.setDate(start.getDate() - 365)
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setDate(end.getDate() + 365)
  end.setHours(23, 59, 59, 999)
  return { startDate: start, endDate: end }
}

const getTodayStart = () => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return todayStart
}

const getMemberName = (members, memberId) => {
  const member = members.find(m => m.id === memberId)
  return member?.displayName || memberId
}

const getAmenityName = (amenities, amenityId) => {
  const amenity = amenities.find(a => a.id === amenityId)
  return amenity?.name || amenityId
}

const getAmenityCategory = (amenities, amenityId) => {
  const amenity = amenities.find(a => a.id === amenityId)
  return amenity?.type || null
}

const isSameDayAsBooking = (booking) => {
  if (!booking?.startTime) return false
  const bookingDate = new Date(booking.startTime)
  const today = new Date()
  return bookingDate.toDateString() === today.toDateString()
}

const BookingRowActions = ({
  booking,
  t,
  onStatusChange,
  onCheckIn,
  onCheckOut,
  onDelete,
  statusPending,
  checkInPending,
  checkOutPending,
  deletePending,
}) => {
  const sameDay = isSameDayAsBooking(booking)
  return (
    <>
      {booking.status === 'pending' && (
        <>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onStatusChange(booking.id, 'approved')}
            disabled={statusPending}
          >
            {t('common.approve')}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onStatusChange(booking.id, 'cancelled')}
            disabled={statusPending}
          >
            {t('common.reject')}
          </button>
        </>
      )}
      {booking.status === 'approved' && (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onCheckIn(booking.id)}
          disabled={!sameDay || checkInPending}
          title={!sameDay ? t('adminBookings.checkInSameDay') : undefined}
        >
          {t('adminBookings.checkIn')}
        </button>
      )}
      {booking.status === 'checked-in' && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onCheckOut(booking.id)}
          disabled={!sameDay || checkOutPending}
          title={!sameDay ? t('adminBookings.checkOutSameDay') : undefined}
        >
          {t('adminBookings.checkOut')}
        </button>
      )}
      <button
        className="btn btn-danger btn-sm"
        onClick={() => onDelete(booking.id)}
        disabled={deletePending}
      >
        {t('common.delete')}
      </button>
    </>
  )
}

const isBeforeTodayStart = (startTime, todayStart) => {
  const bookingStart = startTime instanceof Date ? startTime : new Date(startTime)
  const bookingDayStart = new Date(bookingStart)
  bookingDayStart.setHours(0, 0, 0, 0)
  return bookingDayStart < todayStart
}

const matchesBookingFilters = (booking, filters) => {
  if (filters.statusFilter !== 'all' && booking.status !== filters.statusFilter) {
    return false
  }

  if (filters.categoryFilter !== 'all') {
    const category = getAmenityCategory(filters.amenities, booking.amenityId)
    if (category !== filters.categoryFilter) {
      return false
    }
  }

  if (filters.memberSearch) {
    const memberName = getMemberName(filters.members, booking.memberId).toLowerCase()
    if (!memberName.includes(filters.memberSearch)) {
      return false
    }
  }

  if (!filters.showPastBookings && booking.startTime && isBeforeTodayStart(booking.startTime, filters.todayStart)) {
    return false
  }

  return true
}

const sortBookingsByStartTime = (bookings) => [...bookings].sort((a, b) => {
  const aStart = a.startTime ? (a.startTime instanceof Date ? a.startTime : new Date(a.startTime)) : null
  const bStart = b.startTime ? (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)) : null

  if (!aStart && !bStart) return 0
  if (!aStart) return 1
  if (!bStart) return -1
  return aStart - bStart
})

const paginateBookings = (sortedBookings, currentPage) => {
  const totalBookings = sortedBookings.length
  const totalPages = Math.max(1, Math.ceil(totalBookings / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const endIndex = startIndex + PAGE_SIZE
  const paginatedBookings = sortedBookings.slice(startIndex, endIndex)
  return { totalBookings, totalPages, safePage, startIndex, endIndex, paginatedBookings }
}

const useBookingFilters = () => {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')
  const [showPastBookings, setShowPastBookings] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const handleFilterChangeWrapper = (setter) => (value) => {
    setter(value)
    setCurrentPage(1)
  }

  return {
    statusFilter,
    categoryFilter,
    memberSearch,
    showPastBookings,
    currentPage,
    setStatusFilter,
    setCurrentPage,
    handleStatusFilterChange: handleFilterChangeWrapper(setStatusFilter),
    handleCategoryFilterChange: handleFilterChangeWrapper(setCategoryFilter),
    handleSearchChange: handleFilterChangeWrapper(setMemberSearch),
    handleShowPastChange: handleFilterChangeWrapper(setShowPastBookings),
  }
}

const useBookingMutations = () => {
  const invalidate = useInvalidateQueries()

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => {
      invalidate('bookings', 'memberStats')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      invalidate('bookings', 'memberStats')
    }
  })

  const checkInMutation = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      invalidate('bookings', 'memberStats')
    }
  })

  const checkOutMutation = useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      invalidate('bookings', 'memberStats')
    }
  })

  return { updateMutation, deleteMutation, checkInMutation, checkOutMutation }
}

const EMPTY_ASSIGN_FORM = {
  memberId: '',
  amenityId: '',
  bookingType: 'standard',
  selectedStartTime: null,
  selectedEndTime: null,
  selectedDate: null,
  fdPeriod: 'weekly',
  fdStartDate: '',
}

const createAssignError = (code, message) => {
  const error = new Error(message)
  error.code = code
  return error
}

const checkAssignAvailability = async (form) => {
  try {
    return await checkBookingConflictsStrict(
      form.amenityId,
      form.selectedStartTime,
      form.selectedEndTime
    )
  } catch {
    throw createAssignError('booking-conflict-check-failed', 'Booking conflict check failed')
  }
}

const submitAssignForm = async (form) => {
  if (form.bookingType === 'fixed-desk') {
    return createFixedDeskPlan({
      memberId: form.memberId,
      amenityId: form.amenityId,
      period: form.fdPeriod,
      startDate: form.fdStartDate,
      createdByAdmin: true,
    })
  }
  const conflictCheck = await checkAssignAvailability(form)
  if (conflictCheck.hasConflicts) {
    throw createAssignError('booking-conflict', 'Booking slot is no longer available')
  }
  return createBooking({
    memberId: form.memberId,
    amenityId: form.amenityId,
    startTime: form.selectedStartTime.toISOString(),
    endTime: form.selectedEndTime.toISOString(),
    status: 'approved',
  })
}

const isAssignFormIncomplete = (form) => (
  !form.memberId ||
  !form.amenityId ||
  (form.bookingType === 'standard' && (!form.selectedStartTime || !form.selectedEndTime)) ||
  (form.bookingType === 'fixed-desk' && !form.fdStartDate)
)

const getMemberInputValue = (assignMemberQuery, memberId, members) => (
  assignMemberQuery || (memberId ? (members.find(m => m.id === memberId)?.displayName || members.find(m => m.id === memberId)?.email || '') : '')
)

const AssignStandardCalendar = ({ form, amenities, onRangeChange, onSelectedDateChange, disabled, conflictError, t }) => {
  const amenity = amenities.find(item => item.id === form.amenityId)
  const hasPrerequisites = Boolean(form.memberId && amenity)

  return (
    <div className="booking-range-step">
      {hasPrerequisites ? (
        <BookingCalendar
          className="booking-calendar--compact"
          amenity={amenity}
          onRangeChange={onRangeChange}
          selectedStartTime={form.selectedStartTime}
          selectedEndTime={form.selectedEndTime}
          selectedDate={form.selectedDate}
          onSelectedDateChange={onSelectedDateChange}
          viewMode="week"
          disabled={disabled}
        />
      ) : (
        <p className="form-hint">{t('adminBookings.calendarPrerequisite')}</p>
      )}
      {conflictError && (
        <div className="conflict-error" role="alert">
          <p className="error-message">{conflictError}</p>
        </div>
      )}
    </div>
  )
}

const AssignBookingModal = ({ isOpen, onClose, members, amenities, onAssigned }) => {
  const { t } = useTranslation()
  const [assignMemberQuery, setAssignMemberQuery] = useState('')
  const [assignMemberOpen, setAssignMemberOpen] = useState(false)
  const [memberDropdownRect, setMemberDropdownRect] = useState(null)
  const memberInputRef = useRef(null)

  useEffect(() => {
    if (assignMemberOpen && memberInputRef.current) {
      setMemberDropdownRect(memberInputRef.current.getBoundingClientRect())
    }
  }, [assignMemberOpen])
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM)
  const [assignConflictError, setAssignConflictError] = useState(null)

  const resetAssignForm = () => {
    setAssignForm(EMPTY_ASSIGN_FORM)
    setAssignMemberQuery('')
    setAssignMemberOpen(false)
    setAssignConflictError(null)
  }

  const clearStandardRange = (form) => ({
    ...form,
    selectedStartTime: null,
    selectedEndTime: null,
    selectedDate: null,
  })

  const assignMutation = useMutation({
    mutationFn: submitAssignForm,
    onSuccess: () => {
      onAssigned()
      resetAssignForm()
      showToast(t('toast.bookingAssigned'), 'success')
    },
    onError: (error) => {
      if (error?.code === 'booking-conflict') {
        setAssignConflictError(t('adminBookings.assignConflict'))
        return
      }
      const errorMessage = error?.code === 'booking-conflict-check-failed'
        ? t('adminBookings.assignConflictCheckFailed')
        : t('adminBookings.assignCreateFailed')
      setAssignConflictError(errorMessage)
      showToast(t('toast.bookingAssignFailed'), 'error')
    }
  })

  const handleClose = () => {
    onClose()
    resetAssignForm()
  }

  const handleRangeChange = ({ startTime, endTime }) => {
    const start = startTime ? new Date(startTime) : null
    const end = endTime ? new Date(endTime) : null
    setAssignForm(form => ({
      ...form,
      selectedStartTime: start,
      selectedEndTime: end,
      selectedDate: start || form.selectedDate,
    }))
    setAssignConflictError(null)
  }

  const handleBookingTypeChange = (bookingType) => {
    setAssignForm(form => {
      const next = clearStandardRange({ ...form, bookingType })
      const selectedAmenity = amenities.find(a => a.id === next.amenityId)
      return bookingType === 'fixed-desk' && selectedAmenity?.type !== 'desk'
        ? { ...next, amenityId: '' }
        : next
    })
    setAssignConflictError(null)
  }

  const availableAmenities = assignForm.bookingType === 'fixed-desk'
    ? amenities.filter(amenity => amenity.isAvailable !== false && amenity.type === 'desk')
    : amenities.filter(amenity => amenity.isAvailable !== false)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('adminBookings.assignBooking')}
    >
      <div className="booking-step">
        <div className="form-group">
          <label className="form-label">{t('adminBookings.assignMember')}</label>
          <div className="member-combobox">
            <input
              ref={memberInputRef}
              type="text"
              className="form-field"
              placeholder={t('adminBookings.searchMember')}
              value={getMemberInputValue(assignMemberQuery, assignForm.memberId, members)}
              onChange={e => {
                setAssignMemberQuery(e.target.value)
                setAssignForm(f => clearStandardRange({ ...f, memberId: '' }))
                setAssignConflictError(null)
                setAssignMemberOpen(e.target.value.length > 0)
              }}
              onBlur={() => setTimeout(() => setAssignMemberOpen(false), 150)}
              autoComplete="off"
              disabled={assignMutation.isPending}
            />
            {assignMemberOpen && !assignMutation.isPending && memberDropdownRect && createPortal(
              <ul
                className="member-combobox-list"
                style={{
                  position: 'fixed',
                  top: memberDropdownRect.bottom + 4,
                  left: memberDropdownRect.left,
                  width: memberDropdownRect.width,
                }}
              >
                {members
                  .filter(m => {
                    const q = assignMemberQuery.toLowerCase()
                    return !q ||
                      (m.displayName || '').toLowerCase().includes(q) ||
                      (m.email || '').toLowerCase().includes(q)
                  })
                  .map(m => (
                    <li
                      key={m.id}
                      className={`member-combobox-option${assignForm.memberId === m.id ? ' selected' : ''}`}
                      onMouseDown={() => {
                        setAssignForm(f => clearStandardRange({ ...f, memberId: m.id }))
                        setAssignConflictError(null)
                        setAssignMemberQuery('')
                        setAssignMemberOpen(false)
                      }}
                    >
                      <span className="member-combobox-name">{m.displayName || m.email}</span>
                      {m.displayName && m.email && (
                        <span className="member-combobox-email">{m.email}</span>
                      )}
                    </li>
                  ))}
              </ul>,
              document.body
            )}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('adminBookings.assignAmenity')}</label>
          <select
            className="form-field"
            value={assignForm.amenityId}
            disabled={assignMutation.isPending}
            onChange={e => {
              setAssignForm(f => clearStandardRange({ ...f, amenityId: e.target.value }))
              setAssignConflictError(null)
            }}
          >
            <option value="">{t('adminBookings.selectAmenity')}</option>
            {availableAmenities.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('adminBookings.bookingType')}</label>
          <div className="recurring-frequency-options">
            <label className="form-checkbox">
              <input
                type="radio"
                checked={assignForm.bookingType === 'standard'}
                disabled={assignMutation.isPending}
                onChange={() => handleBookingTypeChange('standard')}
              />
              <span>{t('adminBookings.typeStandard')}</span>
            </label>
            <label className="form-checkbox">
              <input
                type="radio"
                checked={assignForm.bookingType === 'fixed-desk'}
                disabled={assignMutation.isPending}
                onChange={() => handleBookingTypeChange('fixed-desk')}
              />
              <span>{t('adminBookings.typeFixedDesk')}</span>
            </label>
          </div>
        </div>

        {assignForm.bookingType === 'standard' && (
          <AssignStandardCalendar
            form={assignForm}
            amenities={amenities}
            onRangeChange={handleRangeChange}
            onSelectedDateChange={date => setAssignForm(form => ({ ...form, selectedDate: date }))}
            disabled={assignMutation.isPending}
            conflictError={assignConflictError}
            t={t}
          />
        )}

        {assignForm.bookingType === 'fixed-desk' && (
          <>
            <div className="form-group">
              <label className="form-label">{t('fixedDesk.period')}</label>
              <div className="recurring-frequency-options">
                <label className="form-checkbox">
                  <input
                    type="radio"
                    checked={assignForm.fdPeriod === 'weekly'}
                    disabled={assignMutation.isPending}
                    onChange={() => setAssignForm(f => ({ ...f, fdPeriod: 'weekly' }))}
                  />
                  <span>{t('fixedDesk.weekly')}</span>
                </label>
                <label className="form-checkbox">
                  <input
                    type="radio"
                    checked={assignForm.fdPeriod === 'monthly'}
                    disabled={assignMutation.isPending}
                    onChange={() => setAssignForm(f => ({ ...f, fdPeriod: 'monthly' }))}
                  />
                  <span>{t('fixedDesk.monthly')}</span>
                </label>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('fixedDesk.startDate')}</label>
              <input
                type="date"
                className="form-field"
                value={assignForm.fdStartDate}
                disabled={assignMutation.isPending}
                onChange={e => setAssignForm(f => ({ ...f, fdStartDate: e.target.value }))}
              />
            </div>
            <p className="form-hint">{t('fixedDesk.adminAssignNote')}</p>
          </>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClose}
            disabled={assignMutation.isPending}
          >
            {t('common.close')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={assignMutation.isPending || isAssignFormIncomplete(assignForm)}
            onClick={() => assignMutation.mutate(assignForm)}
          >
            {assignMutation.isPending ? t('memberBookings.modal.creating') : t('adminBookings.assignAndApprove')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

const AdminBookings = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const {
    statusFilter,
    categoryFilter,
    memberSearch,
    showPastBookings,
    currentPage,
    setStatusFilter,
    setCurrentPage,
    handleStatusFilterChange,
    handleCategoryFilterChange,
    handleSearchChange,
    handleShowPastChange,
  } = useBookingFilters()
  const invalidate = useInvalidateQueries()

  const adminBookingsWindow = getAdminBookingsWindow()

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => getBookings(adminBookingsWindow)
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const { updateMutation, deleteMutation, checkInMutation, checkOutMutation } = useBookingMutations()
  const rowPending = (id) => ({
    statusPending: isPendingFor(updateMutation, id),
    checkInPending: isPendingFor(checkInMutation, id),
    checkOutPending: isPendingFor(checkOutMutation, id),
    deletePending: isPendingFor(deleteMutation, id),
  })

  const handleStatusChange = async (id, newStatus) => {
    if (isPendingFor(updateMutation, id)) return
    await updateMutation.mutateAsync({ id, data: { status: newStatus } })
  }

  const handleCheckIn = async (id) => {
    if (isPendingFor(checkInMutation, id)) return
    try {
      await checkInMutation.mutateAsync(id)
      showToast(t('toast.bookingCheckedIn'), 'success')
    } catch (err) {
      showToast(err.message || t('toast.bookingCheckInFailed'), 'error')
    }
  }

  const handleCheckOut = async (id) => {
    if (isPendingFor(checkOutMutation, id)) return
    try {
      await checkOutMutation.mutateAsync(id)
      showToast(t('toast.bookingCheckedOut'), 'success')
    } catch (err) {
      showToast(err.message || t('toast.bookingCheckOutFailed'), 'error')
    }
  }

  const handleDelete = async (id) => {
    if (isPendingFor(deleteMutation, id)) return
    if (window.confirm(t('adminBookings.confirmDelete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const normalizedMemberSearch = memberSearch.trim().toLowerCase()
  const todayStart = getTodayStart()

  const filteredBookings = bookings.filter((booking) => matchesBookingFilters(booking, {
    statusFilter,
    categoryFilter,
    memberSearch: normalizedMemberSearch,
    showPastBookings,
    todayStart,
    members,
    amenities,
  }))

  const sortedBookings = sortBookingsByStartTime(filteredBookings)
  const { totalBookings, totalPages, safePage, startIndex, endIndex, paginatedBookings } = paginateBookings(sortedBookings, currentPage)

  const handlePageChange = (direction) => {
    setCurrentPage((prev) => {
      if (direction === 'prev') {
        return Math.max(1, prev - 1)
      }
      if (direction === 'next') {
        return Math.min(totalPages, prev + 1)
      }
      return prev
    })
  }

  const [isApprovingAll, setIsApprovingAll] = useState(false)

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)

  const handleAssigned = () => {
    invalidate('bookings', 'memberStats')
    setIsAssignModalOpen(false)
    setStatusFilter('all')
    setCurrentPage(1)
  }

  const handleApproveAll = async () => {
    const pendingBookings = filteredBookings.filter(b => b.status === 'pending')
    if (pendingBookings.length === 0) return
    if (!window.confirm(t('adminBookings.confirmApproveAll', { count: pendingBookings.length }))) return

    setIsApprovingAll(true)
    try {
      const results = await Promise.allSettled(
        pendingBookings.map(b => updateBooking(b.id, { status: 'approved' }))
      )
      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      invalidate('bookings', 'memberStats')
      if (failed === 0) {
        showToast(t('toast.bookingsApprovedAll', { count: succeeded }), 'success')
      } else {
        showToast(t('toast.bookingsApprovedPartial', { succeeded, failed }), 'error')
      }
    } finally {
      setIsApprovingAll(false)
    }
  }

  const amenityCategories = Array.from(
    new Set(amenities.map((amenity) => amenity.type).filter(Boolean))
  )

  if (isLoading) {
    return (
      <Layout isAdmin>
        <div className="container">
          <div className="spinner"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout isAdmin>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">{t('adminBookings.title')}</h1>
          <div className="page-actions">
            <button
              className="btn btn-primary"
              onClick={() => setIsAssignModalOpen(true)}
            >
              {t('adminBookings.assignBooking')}
            </button>
            {filteredBookings.some(b => b.status === 'pending') && (
              <button
                className="btn btn-primary"
                onClick={handleApproveAll}
                disabled={isApprovingAll}
              >
                {isApprovingAll ? t('adminBookings.approvingAll') : t('adminBookings.approveAll', { count: filteredBookings.filter(b => b.status === 'pending').length })}
              </button>
            )}
          </div>
          <div className="page-filters">
            <select
              className="form-field filter-select"
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
            >
              <option value="all">{t('adminBookings.allStatus')}</option>
              <option value="pending">{t('adminBookings.pending')}</option>
              <option value="approved">{t('adminBookings.approved')}</option>
              <option value="checked-in">{t('adminBookings.checkedIn')}</option>
              <option value="completed">{t('adminBookings.completed')}</option>
              <option value="cancelled">{t('adminBookings.cancelled')}</option>
            </select>

            <select
              className="form-field filter-select"
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
            >
              <option value="all">{t('adminBookings.allCategories')}</option>
              {amenityCategories.map((category) => (
                <option key={category} value={category}>
                  {t(`amenityTypes.${category}`)}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="form-field filter-input"
              placeholder={t('adminBookings.searchByMember')}
              value={memberSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <label className="form-checkbox show-past-toggle">
              <input
                type="checkbox"
                checked={showPastBookings}
                onChange={(e) => handleShowPastChange(e.target.checked)}
              />
              <span>{t('adminBookings.showPast')}</span>
            </label>
          </div>
        </div>

        <div className="bookings-table-container glass">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>{t('adminBookings.member')}</th>
                <th>{t('adminBookings.amenity')}</th>
                <th>{t('adminBookings.startTime')}</th>
                <th>{t('adminBookings.endTime')}</th>
                <th>{t('adminBookings.status')}</th>
                <th>{t('adminBookings.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map(booking => (
                <tr key={booking.id}>
                  <td>{getMemberName(members, booking.memberId)}</td>
                  <td>
                    {getAmenityName(amenities, booking.amenityId)}
                    {booking.planType === 'fixed-desk' && (
                      <span className="fixed-desk-badge-admin">{t('fixedDesk.badge')}</span>
                    )}
                  </td>
                  <td>{booking.startTime ? `${formatDateDDMMYYYY(booking.startTime)} ${new Date(booking.startTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : t('common.na')}</td>
                  <td>{booking.endTime ? `${formatDateDDMMYYYY(booking.endTime)} ${new Date(booking.endTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}` : t('common.na')}</td>
                  <td>
                    <span className={`status-badge ${booking.status}`}>
                      {t(`status.${booking.status || 'pending'}`)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <BookingRowActions
                        booking={booking}
                        t={t}
                        onStatusChange={handleStatusChange}
                        onCheckIn={handleCheckIn}
                        onCheckOut={handleCheckOut}
                        onDelete={handleDelete}
                        {...rowPending(booking.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card Layout */}
          <div className="bookings-mobile-list">
            {paginatedBookings.map(booking => (
              <div key={booking.id} className="booking-card-mobile">
                <div className="booking-card-mobile-header">
                  <div className="booking-card-mobile-title">
                    {getAmenityName(amenities, booking.amenityId)}
                    {booking.planType === 'fixed-desk' && (
                      <span className="fixed-desk-badge-admin">{t('fixedDesk.badge')}</span>
                    )}
                  </div>
                  <span className={`status-badge ${booking.status}`}>
                    {t(`status.${booking.status || 'pending'}`)}
                  </span>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">{t('adminBookings.member')}</div>
                  <div className="booking-card-mobile-value">{getMemberName(members, booking.memberId)}</div>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">{t('adminBookings.startTime')}</div>
                  <div className="booking-card-mobile-value">
                    {booking.startTime
                      ? `${formatDateDDMMYYYY(booking.startTime)} ${new Date(booking.startTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
                      : t('common.na')}
                  </div>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">{t('adminBookings.endTime')}</div>
                  <div className="booking-card-mobile-value">
                    {booking.endTime
                      ? `${formatDateDDMMYYYY(booking.endTime)} ${new Date(booking.endTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
                      : t('common.na')}
                  </div>
                </div>
                <div className="booking-card-mobile-actions">
                  <BookingRowActions
                    booking={booking}
                    t={t}
                    onStatusChange={handleStatusChange}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onDelete={handleDelete}
                    {...rowPending(booking.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          {paginatedBookings.length === 0 && (
            <p className="empty-state">{t('adminBookings.noBookings')}</p>
          )}

          {totalPages > 1 && (
            <div className="bookings-pagination">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange('prev')}
                disabled={safePage === 1}
              >
                {t('adminBookings.prevPage')}
              </button>
              <div className="pagination-info">
                <span className="pagination-page">
                  {t('adminBookings.pageOf', { current: safePage, total: totalPages })}
                </span>
                <span className="pagination-range">
                  {t('adminBookings.showingRange', {
                    from: totalBookings === 0 ? 0 : startIndex + 1,
                    to: Math.min(endIndex, totalBookings),
                    total: totalBookings
                  })}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handlePageChange('next')}
                disabled={safePage === totalPages}
              >
                {t('adminBookings.nextPage')}
              </button>
            </div>
          )}
        </div>
      </div>

      <AssignBookingModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        members={members}
        amenities={amenities}
        onAssigned={handleAssigned}
      />
    </Layout>
  )
}

export default AdminBookings
