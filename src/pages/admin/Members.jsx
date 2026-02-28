import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { getMembers, getMemberStats, updateMember, deleteMember } from '../../services/members'
import './Members.css'
import '../member/Profile.css'

const walletChainLabel = (address) =>
  address?.startsWith('0x') ? 'Ethereum Wallet' : 'Solana Wallet'

const formatMemberSince = (createdAt) => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  const now = new Date()
  const months = Math.floor((now - date) / (1000 * 60 * 60 * 24 * 30))
  if (months < 1) return 'Less than a month'
  if (months === 1) return '1 month'
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  return years === 1 ? '1 year' : `${years} years`
}

const AdminMembers = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [profileModalMember, setProfileModalMember] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })

  const { data: profileStats, isLoading: statsLoading } = useQuery({
    queryKey: ['memberStats', profileModalMember?.id],
    queryFn: () => getMemberStats(profileModalMember.id),
    enabled: !!profileModalMember?.id && isProfileModalOpen
  })

  const updateMutation = useMutation({
    mutationFn: ({ uid, data }) => updateMember(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['members'])
      setIsModalOpen(false)
      setSelectedMember(null)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      queryClient.invalidateQueries(['members'])
    }
  })

  const handleEdit = (member) => {
    setSelectedMember(member)
    setIsModalOpen(true)
  }

  const handleViewProfile = (member) => {
    setProfileModalMember(member)
    setIsProfileModalOpen(true)
  }

  const closeProfileModal = () => {
    setIsProfileModalOpen(false)
    setProfileModalMember(null)
  }

  const handleEditFromProfile = () => {
    if (!profileModalMember) return
    setSelectedMember(profileModalMember)
    closeProfileModal()
    setIsModalOpen(true)
  }

  const handleDelete = async (uid) => {
    if (window.confirm('Are you sure you want to delete this member?')) {
      await deleteMutation.mutateAsync(uid)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = {
      displayName: formData.get('displayName'),
      email: formData.get('email'),
      membershipType: formData.get('membershipType')
    }
    updateMutation.mutate({ uid: selectedMember.id, data })
  }

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
          <h1 className="page-title">Members</h1>
        </div>

        <div className="members-table-container glass">
          <table className="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Membership Type</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <td>
                    <div className="member-cell">
                      <Avatar 
                        src={member.photoURL} 
                        name={member.displayName}
                        size="sm"
                      />
                      <span>{member.displayName || 'N/A'}</span>
                    </div>
                  </td>
                  <td>{member.email || 'N/A'}</td>
                  <td>
                    <span className={`membership-badge ${member.membershipType}`}>
                      {member.membershipType || 'member'}
                    </span>
                  </td>
                  <td>{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn btn-view-profile btn-sm"
                        onClick={() => handleViewProfile(member)}
                      >
                        View profile
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(member)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(member.id)}
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
          <div className="members-mobile-list">
            {members.map(member => (
              <div key={member.id} className="member-card-mobile">
                <div className="member-card-mobile-header">
                  <Avatar 
                    src={member.photoURL} 
                    name={member.displayName}
                    size="md"
                  />
                  <div className="member-card-mobile-info">
                    <div className="member-card-mobile-name">{member.displayName || 'N/A'}</div>
                    <span className={`membership-badge ${member.membershipType}`}>
                      {member.membershipType || 'member'}
                    </span>
                  </div>
                </div>
                <div className="member-card-mobile-field">
                  <div className="member-card-mobile-label">Email</div>
                  <div className="member-card-mobile-value">{member.email || 'N/A'}</div>
                </div>
                <div className="member-card-mobile-field">
                  <div className="member-card-mobile-label">Created</div>
                  <div className="member-card-mobile-value">
                    {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <div className="member-card-mobile-actions">
                  <button 
                    className="btn btn-view-profile btn-sm"
                    onClick={() => handleViewProfile(member)}
                  >
                    View profile
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(member)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(member.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedMember(null)
          }}
          title="Edit Member"
        >
          {selectedMember && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  name="displayName"
                  className="form-field"
                  defaultValue={selectedMember.displayName}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  className="form-field"
                  defaultValue={selectedMember.email}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Membership Type</label>
                <select name="membershipType" className="form-field" defaultValue={selectedMember.membershipType}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsModalOpen(false)
                    setSelectedMember(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </Modal>

        <Modal
          isOpen={isProfileModalOpen}
          onClose={closeProfileModal}
          title={profileModalMember ? `${profileModalMember.displayName || 'Member'}'s profile` : 'Member profile'}
        >
          {profileModalMember && (
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar-wrap">
                  <Avatar
                    src={profileModalMember.photoURL}
                    name={profileModalMember.displayName}
                    size="xl"
                    className="profile-avatar"
                  />
                </div>
                <div className="profile-info">
                  <h2 className="profile-name">{profileModalMember.displayName || 'N/A'}</h2>
                  <p className="profile-email">{profileModalMember.email || 'N/A'}</p>
                  <span className={`membership-badge ${profileModalMember.membershipType}`}>
                    {profileModalMember.membershipType || 'member'}
                  </span>
                </div>
              </div>

              <section className="profile-section">
                <h3 className="profile-section-title">Basic Info</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Display Name</span>
                  <span className="detail-value">{profileModalMember.displayName || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{profileModalMember.email || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{profileModalMember.phone || '—'}</span>
                </div>
                {profileModalMember.walletAddress && (
                  <div className="profile-detail-item profile-detail-wallet">
                    <span className="detail-label">{walletChainLabel(profileModalMember.walletAddress)}</span>
                    <span className="detail-value wallet-address-display">
                      <span className="wallet-address-text">{profileModalMember.walletAddress}</span>
                    </span>
                  </div>
                )}
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">Professional</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Company</span>
                  <span className="detail-value">{profileModalMember.company || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Role</span>
                  <span className="detail-value">{profileModalMember.jobTitle || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">LinkedIn</span>
                  <span className="detail-value">
                    {profileModalMember.linkedIn ? (
                      <a href={profileModalMember.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {profileModalMember.linkedIn}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Website</span>
                  <span className="detail-value">
                    {profileModalMember.website ? (
                      <a href={profileModalMember.website} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {profileModalMember.website}
                      </a>
                    ) : '—'}
                  </span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">About</h3>
                <div className="profile-detail-item profile-detail-bio">
                  <span className="detail-label">Bio</span>
                  <span className="detail-value">{profileModalMember.bio || '—'}</span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">Preferences</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Email notifications</span>
                  <span className="detail-value">
                    {(profileModalMember.preferences?.emailNotifications !== false) ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Event reminders</span>
                  <span className="detail-value">
                    {(profileModalMember.preferences?.eventReminders !== false) ? 'On' : 'Off'}
                  </span>
                </div>
              </section>

              <section className="profile-section profile-section-activity">
                <h3 className="profile-section-title">Activity</h3>
                {statsLoading ? (
                  <div className="profile-stats-loading">Loading…</div>
                ) : profileStats ? (
                  <div className="profile-stats">
                    <div className="profile-stat">
                      <span className="profile-stat-value">{profileStats.totalBookings}</span>
                      <span className="profile-stat-label">Bookings</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{profileStats.eventsAttended}</span>
                      <span className="profile-stat-label">Events attended</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{profileStats.eventsOrganized}</span>
                      <span className="profile-stat-label">Events organized</span>
                    </div>
                  </div>
                ) : null}
                <div className="profile-detail-item">
                  <span className="detail-label">Member since</span>
                  <span className="detail-value">
                    {profileModalMember.createdAt
                      ? `${new Date(profileModalMember.createdAt).toLocaleDateString()} (${formatMemberSince(profileModalMember.createdAt)})`
                      : 'N/A'}
                  </span>
                </div>
              </section>

              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={handleEditFromProfile}>
                  Edit
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeProfileModal}>
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </Layout>
  )
}

export default AdminMembers
