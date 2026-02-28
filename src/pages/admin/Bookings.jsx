import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import { showToast } from '../../components/Toast'
import { getBookings, updateBooking, deleteBooking, checkIn, checkOut } from '../../services/bookings'
import { getMembers } from '../../services/members'
import { getAmenities } from '../../services/amenities'
import './Bookings.css'

const AdminBookings = () => {
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
      showToast('Booking checked in successfully', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to check in booking', 'error')
    }
  }

  const handleCheckOut = async (id) => {
    try {
      await checkOutMutation.mutateAsync(id)
      showToast('Booking checked out successfully', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to check out booking', 'error')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
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
          <h1 className="page-title">Bookings</h1>
          <select 
            className="form-field filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="checked-in">Checked In</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="bookings-table-container glass">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Amenity</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(booking => (
                <tr key={booking.id}>
                  <td>{getMemberName(booking.memberId)}</td>
                  <td>{getAmenityName(booking.amenityId)}</td>
                  <td>{booking.startTime?.toLocaleString() || 'N/A'}</td>
                  <td>{booking.endTime?.toLocaleString() || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${booking.status}`}>
                      {booking.status || 'pending'}
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
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleStatusChange(booking.id, 'cancelled')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {booking.status === 'approved' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckIn(booking.id)}
                          disabled={!isSameDayAsBooking(booking)}
                          title={!isSameDayAsBooking(booking) ? 'Check In is only allowed on the same day as the booking' : undefined}
                        >
                          Check In
                        </button>
                      )}
                      {booking.status === 'checked-in' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCheckOut(booking.id)}
                          disabled={!isSameDayAsBooking(booking)}
                          title={!isSameDayAsBooking(booking) ? 'Check Out is only allowed on the same day as the booking' : undefined}
                        >
                          Check Out
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(booking.id)}
                      >
                        Delete
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
                    {booking.status || 'pending'}
                  </span>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">Member</div>
                  <div className="booking-card-mobile-value">{getMemberName(booking.memberId)}</div>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">Start Time</div>
                  <div className="booking-card-mobile-value">{booking.startTime?.toLocaleString() || 'N/A'}</div>
                </div>
                <div className="booking-card-mobile-field">
                  <div className="booking-card-mobile-label">End Time</div>
                  <div className="booking-card-mobile-value">{booking.endTime?.toLocaleString() || 'N/A'}</div>
                </div>
                <div className="booking-card-mobile-actions">
                  {booking.status === 'pending' && (
                    <>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStatusChange(booking.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleStatusChange(booking.id, 'cancelled')}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {booking.status === 'approved' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCheckIn(booking.id)}
                      disabled={!isSameDayAsBooking(booking)}
                      title={!isSameDayAsBooking(booking) ? 'Check In is only allowed on the same day as the booking' : undefined}
                    >
                      Check In
                    </button>
                  )}
                  {booking.status === 'checked-in' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCheckOut(booking.id)}
                      disabled={!isSameDayAsBooking(booking)}
                      title={!isSameDayAsBooking(booking) ? 'Check Out is only allowed on the same day as the booking' : undefined}
                    >
                      Check Out
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(booking.id)}
                  >
                    Delete
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
