import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import { showToast } from '../../components/Toast'
import { getBookings, updateBooking, deleteBooking, checkIn, checkOut } from '../../services/bookings'
import { getMembers } from '../../services/members'
import { getAmenities } from '../../services/amenities'
import './Bookings.css'

const AdminBookings = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')
  const [showPastBookings, setShowPastBookings] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const queryClient = useQueryClient()

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings
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
                  <td>{getAmenityName(booking.amenityId)}</td>
                  <td>{booking.startTime?.toLocaleString(locale) || t('common.na')}</td>
                  <td>{booking.endTime?.toLocaleString(locale) || t('common.na')}</td>
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
                  <div className="booking-card-mobile-value">{booking.startTime?.toLocaleString(locale) || t('common.na')}</div>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">{t('adminBookings.endTime')}</div>
                  <div className="booking-card-mobile-value">{booking.endTime?.toLocaleString(locale) || t('common.na')}</div>
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
    </Layout>
  )
}

export default AdminBookings
