import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import { showToast } from '../../components/Toast'
import { getBookings, updateBooking, deleteBooking, checkIn, checkOut, createBooking, createFixedDeskPlan } from '../../services/bookings'
import { getMembers } from '../../services/members'
import { getAmenities } from '../../services/amenities'
import './Bookings.css'
import { formatDateDDMMYYYY } from '../../utils/timezone'

const AdminBookings = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [statusFilter, setStatusFilter] = useState('pending')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')
  const [showPastBookings, setShowPastBookings] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const queryClient = useQueryClient()

  // Admin "view all" intent — fetch a generous ±365 day window rather than
  // the entire bookings collection (which is unbounded over time).
  const adminBookingsWindow = (() => {
    const start = new Date()
    start.setDate(start.getDate() - 365)
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setDate(end.getDate() + 365)
    end.setHours(23, 59, 59, 999)
    return { startDate: start, endDate: end }
  })()

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateBooking(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooking,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
    }
  })

  const checkInMutation = useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
    }
  })

  const checkOutMutation = useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
    }
  })

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId)
    return member?.displayName || memberId
  }

  const getAmenityName = (amenityId) => {
    const amenity = amenities.find(a => a.id === amenityId)
    return amenity?.name || amenityId
  }

  const getAmenityCategory = (amenityId) => {
    const amenity = amenities.find(a => a.id === amenityId)
    return amenity?.type || null
  }

  const isSameDayAsBooking = (booking) => {
    if (!booking?.startTime) return false
    const bookingDate = new Date(booking.startTime)
    const today = new Date()
    return bookingDate.toDateString() === today.toDateString()
  }

  const handleStatusChange = async (id, newStatus) => {
    await updateMutation.mutateAsync({ id, data: { status: newStatus } })
  }

  const handleCheckIn = async (id) => {
    try {
      await checkInMutation.mutateAsync(id)
      showToast(t('toast.bookingCheckedIn'), 'success')
    } catch (err) {
      showToast(err.message || t('toast.bookingCheckInFailed'), 'error')
    }
  }

  const handleCheckOut = async (id) => {
    try {
      await checkOutMutation.mutateAsync(id)
      showToast(t('toast.bookingCheckedOut'), 'success')
    } catch (err) {
      showToast(err.message || t('toast.bookingCheckOutFailed'), 'error')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm(t('adminBookings.confirmDelete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const normalizedMemberSearch = memberSearch.trim().toLowerCase()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const filteredBookings = bookings.filter((booking) => {
    if (statusFilter !== 'all' && booking.status !== statusFilter) {
      return false
    }

    if (categoryFilter !== 'all') {
      const category = getAmenityCategory(booking.amenityId)
      if (category !== categoryFilter) {
        return false
      }
    }

    if (normalizedMemberSearch) {
      const memberName = getMemberName(booking.memberId).toLowerCase()
      if (!memberName.includes(normalizedMemberSearch)) {
        return false
      }
    }

    if (!showPastBookings && booking.startTime) {
      const bookingStart = booking.startTime instanceof Date
        ? booking.startTime
        : new Date(booking.startTime)
      const bookingDayStart = new Date(bookingStart)
      bookingDayStart.setHours(0, 0, 0, 0)

      if (bookingDayStart < todayStart) {
        return false
      }
    }

    return true
  })

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const aStart = a.startTime ? (a.startTime instanceof Date ? a.startTime : new Date(a.startTime)) : null
    const bStart = b.startTime ? (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)) : null

    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1
    return aStart - bStart
  })

  const totalBookings = sortedBookings.length
  const totalPages = Math.max(1, Math.ceil(totalBookings / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedBookings = sortedBookings.slice(startIndex, endIndex)

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

  const handleFilterChangeWrapper = (setter) => (value) => {
    setter(value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = handleFilterChangeWrapper(setStatusFilter)
  const handleCategoryFilterChange = handleFilterChangeWrapper(setCategoryFilter)
  const handleSearchChange = (value) => {
    setMemberSearch(value)
    setCurrentPage(1)
  }
  const handleShowPastChange = (checked) => {
    setShowPastBookings(checked)
    setCurrentPage(1)
  }

  const [isApprovingAll, setIsApprovingAll] = useState(false)

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignMemberQuery, setAssignMemberQuery] = useState('')
  const [assignMemberOpen, setAssignMemberOpen] = useState(false)
  const [memberDropdownRect, setMemberDropdownRect] = useState(null)
  const memberInputRef = useRef(null)

  useEffect(() => {
    if (assignMemberOpen && memberInputRef.current) {
      setMemberDropdownRect(memberInputRef.current.getBoundingClientRect())
    }
  }, [assignMemberOpen])
  const [assignForm, setAssignForm] = useState({
    memberId: '',
    amenityId: '',
    bookingType: 'standard',
    date: '',
    startTime: '',
    endTime: '',
    fdPeriod: 'weekly',
    fdStartDate: '',
  })

  const assignMutation = useMutation({
    mutationFn: async (form) => {
      if (form.bookingType === 'fixed-desk') {
        return createFixedDeskPlan({
          memberId: form.memberId,
          amenityId: form.amenityId,
          period: form.fdPeriod,
          startDate: form.fdStartDate,
          createdByAdmin: true,
        })
      }
      return createBooking({
        memberId: form.memberId,
        amenityId: form.amenityId,
        startTime: new Date(`${form.date}T${form.startTime}`).toISOString(),
        endTime: new Date(`${form.date}T${form.endTime}`).toISOString(),
        status: 'approved',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings'])
      setIsAssignModalOpen(false)
      setAssignForm({ memberId: '', amenityId: '', bookingType: 'standard', date: '', startTime: '', endTime: '', fdPeriod: 'weekly', fdStartDate: '' })
      setAssignMemberQuery('')
      setAssignMemberOpen(false)
      setStatusFilter('all')
      setCurrentPage(1)
      showToast(t('toast.bookingAssigned'), 'success')
    },
    onError: () => {
      showToast(t('toast.bookingAssignFailed'), 'error')
    }
  })

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
      queryClient.invalidateQueries(['bookings'])
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
                  <td>{getMemberName(booking.memberId)}</td>
                  <td>
                    {getAmenityName(booking.amenityId)}
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
                      {booking.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleStatusChange(booking.id, 'approved')}
                          >
                            {t('common.approve')}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          >
                            {t('common.reject')}
                          </button>
                        </>
                      )}
                      {booking.status === 'approved' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckIn(booking.id)}
                          disabled={!isSameDayAsBooking(booking)}
                          title={!isSameDayAsBooking(booking) ? t('adminBookings.checkInSameDay') : undefined}
                        >
                          {t('adminBookings.checkIn')}
                        </button>
                      )}
                      {booking.status === 'checked-in' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCheckOut(booking.id)}
                          disabled={!isSameDayAsBooking(booking)}
                          title={!isSameDayAsBooking(booking) ? t('adminBookings.checkOutSameDay') : undefined}
                        >
                          {t('adminBookings.checkOut')}
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(booking.id)}
                      >
                        {t('common.delete')}
                      </button>
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
                    {getAmenityName(booking.amenityId)}
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
                  <div className="booking-card-mobile-value">{getMemberName(booking.memberId)}</div>
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
                  {booking.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStatusChange(booking.id, 'approved')}
                      >
                        {t('common.approve')}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleStatusChange(booking.id, 'cancelled')}
                      >
                        {t('common.reject')}
                      </button>
                    </>
                  )}
                  {booking.status === 'approved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCheckIn(booking.id)}
                      disabled={!isSameDayAsBooking(booking)}
                      title={!isSameDayAsBooking(booking) ? t('adminBookings.checkInSameDay') : undefined}
                    >
                      {t('adminBookings.checkIn')}
                    </button>
                  )}
                  {booking.status === 'checked-in' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCheckOut(booking.id)}
                      disabled={!isSameDayAsBooking(booking)}
                      title={!isSameDayAsBooking(booking) ? t('adminBookings.checkOutSameDay') : undefined}
                    >
                      {t('adminBookings.checkOut')}
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(booking.id)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

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
        </div>
      </div>

      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => { setIsAssignModalOpen(false); setAssignMemberQuery(''); setAssignMemberOpen(false) }}
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
                value={assignMemberQuery || (assignForm.memberId ? (members.find(m => m.id === assignForm.memberId)?.displayName || members.find(m => m.id === assignForm.memberId)?.email || '') : '')}
                onChange={e => {
                  setAssignMemberQuery(e.target.value)
                  setAssignForm(f => ({ ...f, memberId: '' }))
                  setAssignMemberOpen(e.target.value.length > 0)
                }}
                onBlur={() => setTimeout(() => setAssignMemberOpen(false), 150)}
                autoComplete="off"
              />
              {assignMemberOpen && memberDropdownRect && createPortal(
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
                          setAssignForm(f => ({ ...f, memberId: m.id }))
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
              onChange={e => setAssignForm(f => ({ ...f, amenityId: e.target.value }))}
            >
              <option value="">{t('adminBookings.selectAmenity')}</option>
              {amenities.map(a => (
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
                  onChange={() => setAssignForm(f => ({ ...f, bookingType: 'standard' }))}
                />
                <span>{t('adminBookings.typeStandard')}</span>
              </label>
              <label className="form-checkbox">
                <input
                  type="radio"
                  checked={assignForm.bookingType === 'fixed-desk'}
                  onChange={() => setAssignForm(f => ({ ...f, bookingType: 'fixed-desk' }))}
                />
                <span>{t('adminBookings.typeFixedDesk')}</span>
              </label>
            </div>
          </div>

          {assignForm.bookingType === 'standard' && (
            <>
              <div className="form-group">
                <label className="form-label">{t('adminBookings.assignDate')}</label>
                <input
                  type="date"
                  className="form-field"
                  value={assignForm.date}
                  onChange={e => setAssignForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="assign-time-row">
                <div className="form-group">
                  <label className="form-label">{t('adminBookings.assignStartTime')}</label>
                  <input
                    type="time"
                    className="form-field"
                    value={assignForm.startTime}
                    onChange={e => setAssignForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('adminBookings.assignEndTime')}</label>
                  <input
                    type="time"
                    className="form-field"
                    value={assignForm.endTime}
                    onChange={e => setAssignForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </>
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
                      onChange={() => setAssignForm(f => ({ ...f, fdPeriod: 'weekly' }))}
                    />
                    <span>{t('fixedDesk.weekly')}</span>
                  </label>
                  <label className="form-checkbox">
                    <input
                      type="radio"
                      checked={assignForm.fdPeriod === 'monthly'}
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
              onClick={() => { setIsAssignModalOpen(false); setAssignMemberQuery(''); setAssignMemberOpen(false) }}
            >
              {t('common.close')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                assignMutation.isPending ||
                !assignForm.memberId ||
                !assignForm.amenityId ||
                (assignForm.bookingType === 'standard' && (!assignForm.date || !assignForm.startTime || !assignForm.endTime)) ||
                (assignForm.bookingType === 'fixed-desk' && !assignForm.fdStartDate)
              }
              onClick={() => assignMutation.mutate(assignForm)}
            >
              {assignMutation.isPending ? t('memberBookings.modal.creating') : t('adminBookings.assignAndApprove')}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

export default AdminBookings
