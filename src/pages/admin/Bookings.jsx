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

  const filteredBookings = statusFilter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === statusFilter)

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
          <select 
            className="form-field filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('adminBookings.allStatus')}</option>
            <option value="pending">{t('adminBookings.pending')}</option>
            <option value="approved">{t('adminBookings.approved')}</option>
            <option value="checked-in">{t('adminBookings.checkedIn')}</option>
            <option value="completed">{t('adminBookings.completed')}</option>
            <option value="cancelled">{t('adminBookings.cancelled')}</option>
          </select>
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
              {filteredBookings.map(booking => (
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
            {filteredBookings.map(booking => (
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
        </div>
      </div>
    </Layout>
  )
}

export default AdminBookings
