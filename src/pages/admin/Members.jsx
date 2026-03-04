import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { getMembers, getMemberStats, updateMember, deleteMember } from '../../services/members'
import './Members.css'
import '../member/Profile.css'

const walletChainLabel = (address) =>
  address?.startsWith('0x') ? 'auth.ethereumWallet' : 'auth.solanaWallet'

const formatMemberSince = (createdAt, t) => {
  if (!createdAt) return null
  const date = new Date(createdAt)
  const now = new Date()
  const months = Math.floor((now - date) / (1000 * 60 * 60 * 24 * 30))
  if (months < 1) return t('profile.memberSinceRelative.lessThanMonth')
  if (months === 1) return t('profile.memberSinceRelative.oneMonth')
  if (months < 12) return t('profile.memberSinceRelative.months', { count: months })
  const years = Math.floor(months / 12)
  return years === 1 ? t('profile.memberSinceRelative.oneYear') : t('profile.memberSinceRelative.years', { count: years })
}

const AdminMembers = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
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
    if (window.confirm(t('adminMembers.confirmDelete'))) {
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
          <h1 className="page-title">{t('adminMembers.title')}</h1>
        </div>

        <div className="members-table-container glass">
          <table className="members-table">
            <thead>
              <tr>
                <th>{t('adminMembers.name')}</th>
                <th>{t('adminMembers.email')}</th>
                <th>{t('adminMembers.membershipType')}</th>
                <th>{t('adminMembers.created')}</th>
                <th>{t('adminMembers.actions')}</th>
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
                      <span>{member.displayName || t('common.na')}</span>
                    </div>
                  </td>
                  <td>{member.email || t('common.na')}</td>
                  <td>
                    <span className={`membership-badge ${member.membershipType}`}>
                      {t(`status.${member.membershipType || 'member'}`)}
                    </span>
                  </td>
                  <td>{member.createdAt ? new Date(member.createdAt).toLocaleDateString(locale) : t('common.na')}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn btn-view-profile btn-sm"
                        onClick={() => handleViewProfile(member)}
                      >
                        {t('common.viewProfile')}
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(member)}
                      >
                        {t('common.edit')}
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(member.id)}
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
                    <div className="member-card-mobile-name">{member.displayName || t('common.na')}</div>
                    <span className={`membership-badge ${member.membershipType}`}>
                      {t(`status.${member.membershipType || 'member'}`)}
                    </span>
                  </div>
                </div>
                <div className="member-card-mobile-field">
                  <div className="member-card-mobile-label">{t('adminMembers.email')}</div>
                  <div className="member-card-mobile-value">{member.email || t('common.na')}</div>
                </div>
                <div className="member-card-mobile-field">
                  <div className="member-card-mobile-label">{t('adminMembers.created')}</div>
                  <div className="member-card-mobile-value">
                    {member.createdAt ? new Date(member.createdAt).toLocaleDateString(locale) : t('common.na')}
                  </div>
                </div>
                <div className="member-card-mobile-actions">
                  <button 
                    className="btn btn-view-profile btn-sm"
                    onClick={() => handleViewProfile(member)}
                  >
                    {t('common.viewProfile')}
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleEdit(member)}
                  >
                    {t('common.edit')}
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(member.id)}
                  >
                    {t('common.delete')}
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
          title={t('adminMembers.editMember')}
        >
          {selectedMember && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('profile.displayName')}</label>
                <input
                  type="text"
                  name="displayName"
                  className="form-field"
                  defaultValue={selectedMember.displayName}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('profile.email')}</label>
                <input
                  type="email"
                  name="email"
                  className="form-field"
                  defaultValue={selectedMember.email}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('adminMembers.membershipType')}</label>
                <select name="membershipType" className="form-field" defaultValue={selectedMember.membershipType}>
                  <option value="member">{t('adminMembers.memberOption')}</option>
                  <option value="admin">{t('adminMembers.adminOption')}</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {t('common.save')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsModalOpen(false)
                    setSelectedMember(null)
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
        </Modal>

        <Modal
          isOpen={isProfileModalOpen}
          onClose={closeProfileModal}
          title={profileModalMember ? t('adminMembers.memberProfileTitle', { name: profileModalMember.displayName || t('adminMembers.title') }) : t('adminMembers.memberProfile')}
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
                  <h2 className="profile-name">{profileModalMember.displayName || t('common.na')}</h2>
                  <p className="profile-email">{profileModalMember.email || t('common.na')}</p>
                  <span className={`membership-badge ${profileModalMember.membershipType}`}>
                    {t(`status.${profileModalMember.membershipType || 'member'}`)}
                  </span>
                </div>
              </div>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.basicInfo')}</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.displayName')}</span>
                  <span className="detail-value">{profileModalMember.displayName || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.email')}</span>
                  <span className="detail-value">{profileModalMember.email || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.phone')}</span>
                  <span className="detail-value">{profileModalMember.phone || '—'}</span>
                </div>
                {profileModalMember.walletAddress && (
                  <div className="profile-detail-item profile-detail-wallet">
                    <span className="detail-label">{t(walletChainLabel(profileModalMember.walletAddress))}</span>
                    <span className="detail-value wallet-address-display">
                      <span className="wallet-address-text">{profileModalMember.walletAddress}</span>
                    </span>
                  </div>
                )}
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.professional')}</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.company')}</span>
                  <span className="detail-value">{profileModalMember.company || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.role')}</span>
                  <span className="detail-value">{profileModalMember.jobTitle || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.linkedIn')}</span>
                  <span className="detail-value">
                    {profileModalMember.linkedIn ? (
                      <a href={profileModalMember.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {profileModalMember.linkedIn}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.website')}</span>
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
                <h3 className="profile-section-title">{t('profile.about')}</h3>
                <div className="profile-detail-item profile-detail-bio">
                  <span className="detail-label">{t('profile.bio')}</span>
                  <span className="detail-value">{profileModalMember.bio || '—'}</span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.preferences')}</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.emailNotifications')}</span>
                  <span className="detail-value">
                    {(profileModalMember.preferences?.emailNotifications !== false) ? t('common.on') : t('common.off')}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.eventReminders')}</span>
                  <span className="detail-value">
                    {(profileModalMember.preferences?.eventReminders !== false) ? t('common.on') : t('common.off')}
                  </span>
                </div>
              </section>

              <section className="profile-section profile-section-activity">
                <h3 className="profile-section-title">{t('profile.activity')}</h3>
                {statsLoading ? (
                  <div className="profile-stats-loading">{t('common.loading')}</div>
                ) : profileStats ? (
                  <div className="profile-stats">
                    <div className="profile-stat">
                      <span className="profile-stat-value">{profileStats.totalBookings}</span>
                      <span className="profile-stat-label">{t('profile.bookings')}</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{profileStats.eventsAttended}</span>
                      <span className="profile-stat-label">{t('profile.eventsAttended')}</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{profileStats.eventsOrganized}</span>
                      <span className="profile-stat-label">{t('profile.eventsOrganized')}</span>
                    </div>
                  </div>
                ) : null}
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.memberSince')}</span>
                  <span className="detail-value">
                    {profileModalMember.createdAt
                      ? `${new Date(profileModalMember.createdAt).toLocaleDateString(locale)} (${formatMemberSince(profileModalMember.createdAt, t)})`
                      : t('common.na')}
                  </span>
                </div>
              </section>

              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={handleEditFromProfile}>
                  {t('common.edit')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeProfileModal}>
                  {t('common.close')}
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
