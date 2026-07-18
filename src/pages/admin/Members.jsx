import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useInvalidateQueries } from '../../hooks/useInvalidateQueries'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { getMembers, getMemberStats, updateMember, deleteMember } from '../../services/members'
import './Members.css'
import { formatDateDDMMYYYY } from '../../utils/timezone'
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

const profileModalTitle = (member, t) =>
  member
    ? t('adminMembers.memberProfileTitle', { name: member.displayName || t('adminMembers.title') })
    : t('adminMembers.memberProfile')

const MemberEditForm = ({ member, t, onSubmit, onCancel }) => {
  if (!member) return null
  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label className="form-label">{t('profile.displayName')}</label>
        <input
          type="text"
          name="displayName"
          className="form-field"
          defaultValue={member.displayName}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">{t('profile.email')}</label>
        <input
          type="email"
          name="email"
          className="form-field"
          defaultValue={member.email}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">{t('adminMembers.membershipType')}</label>
        <select name="membershipType" className="form-field" defaultValue={member.membershipType}>
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
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

const MemberProfileHeader = ({ member, t }) => (
  <div className="profile-header">
    <div className="profile-avatar-wrap">
      <Avatar
        src={member.photoURL}
        name={member.displayName}
        size="xl"
        className="profile-avatar"
      />
    </div>
    <div className="profile-info">
      <h2 className="profile-name">{member.displayName || t('common.na')}</h2>
      <p className="profile-email">{member.email || t('common.na')}</p>
      <span className={`membership-badge ${member.membershipType}`}>
        {t(`status.${member.membershipType || 'member'}`)}
      </span>
    </div>
  </div>
)

const MemberBasicInfoSection = ({ member, t }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">{t('profile.basicInfo')}</h3>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.displayName')}</span>
      <span className="detail-value">{member.displayName || '—'}</span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.email')}</span>
      <span className="detail-value">{member.email || '—'}</span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.phone')}</span>
      <span className="detail-value">{member.phone || '—'}</span>
    </div>
    {member.walletAddress && (
      <div className="profile-detail-item profile-detail-wallet">
        <span className="detail-label">{t(walletChainLabel(member.walletAddress))}</span>
        <span className="detail-value wallet-address-display">
          <span className="wallet-address-text">{member.walletAddress}</span>
        </span>
      </div>
    )}
  </section>
)

const MemberProfessionalSection = ({ member, t }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">{t('profile.professional')}</h3>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.company')}</span>
      <span className="detail-value">{member.company || '—'}</span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.role')}</span>
      <span className="detail-value">{member.jobTitle || '—'}</span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.linkedIn')}</span>
      <span className="detail-value">
        {member.linkedIn ? (
          <a href={member.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
            {member.linkedIn}
          </a>
        ) : '—'}
      </span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.website')}</span>
      <span className="detail-value">
        {member.website ? (
          <a href={member.website} target="_blank" rel="noopener noreferrer" className="profile-link">
            {member.website}
          </a>
        ) : '—'}
      </span>
    </div>
  </section>
)

const MemberAboutSection = ({ member, t }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">{t('profile.about')}</h3>
    <div className="profile-detail-item profile-detail-bio">
      <span className="detail-label">{t('profile.bio')}</span>
      <span className="detail-value">{member.bio || '—'}</span>
    </div>
  </section>
)

const MemberPreferencesSection = ({ member, t }) => (
  <section className="profile-section">
    <h3 className="profile-section-title">{t('profile.preferences')}</h3>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.emailNotifications')}</span>
      <span className="detail-value">
        {(member.preferences?.emailNotifications !== false) ? t('common.on') : t('common.off')}
      </span>
    </div>
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.eventReminders')}</span>
      <span className="detail-value">
        {(member.preferences?.eventReminders !== false) ? t('common.on') : t('common.off')}
      </span>
    </div>
  </section>
)

const MemberActivitySection = ({ member, stats, statsLoading, t }) => (
  <section className="profile-section profile-section-activity">
    <h3 className="profile-section-title">{t('profile.activity')}</h3>
    {statsLoading ? (
      <div className="profile-stats-loading">{t('common.loading')}</div>
    ) : stats ? (
      <div className="profile-stats">
        <div className="profile-stat">
          <span className="profile-stat-value">{stats.totalBookings}</span>
          <span className="profile-stat-label">{t('profile.bookings')}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{stats.eventsAttended}</span>
          <span className="profile-stat-label">{t('profile.eventsAttended')}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-value">{stats.eventsOrganized}</span>
          <span className="profile-stat-label">{t('profile.eventsOrganized')}</span>
        </div>
      </div>
    ) : null}
    <div className="profile-detail-item">
      <span className="detail-label">{t('profile.memberSince')}</span>
      <span className="detail-value">
        {member.createdAt
          ? `${formatDateDDMMYYYY(member.createdAt)} (${formatMemberSince(member.createdAt, t)})`
          : t('common.na')}
      </span>
    </div>
  </section>
)

const MemberProfileBody = ({ member, stats, statsLoading, t, onEdit, onClose }) => {
  if (!member) return null
  return (
    <div className="profile-modal-content">
      <MemberProfileHeader member={member} t={t} />
      <MemberBasicInfoSection member={member} t={t} />
      <MemberProfessionalSection member={member} t={t} />
      <MemberAboutSection member={member} t={t} />
      <MemberPreferencesSection member={member} t={t} />
      <MemberActivitySection member={member} stats={stats} statsLoading={statsLoading} t={t} />

      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          {t('common.edit')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}

const AdminMembers = () => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [profileModalMember, setProfileModalMember] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const invalidate = useInvalidateQueries()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
  })

  const { data: profileStats, isLoading: statsLoading } = useQuery({
    queryKey: ['memberStats', profileModalMember?.id],
    queryFn: () => getMemberStats(profileModalMember.id),
    enabled: !!profileModalMember?.id && isProfileModalOpen
  })

  const filteredMembers = searchQuery.trim()
    ? members.filter(m => {
        const q = searchQuery.toLowerCase()
        return (
          (m.displayName || '').toLowerCase().includes(q) ||
          (m.company || '').toLowerCase().includes(q)
        )
      })
    : members

  const updateMutation = useMutation({
    mutationFn: ({ uid, data }) => updateMember(uid, data),
    onSuccess: () => {
      invalidate('members')
      setIsModalOpen(false)
      setSelectedMember(null)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      invalidate('members')
    }
  })

  const handleEdit = (member) => {
    setSelectedMember(member)
    setIsModalOpen(true)
  }

  const closeEditModal = () => {
    setIsModalOpen(false)
    setSelectedMember(null)
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
          <div className="members-search-pill">
            <svg className="members-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13.25 13.25L17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              className="members-search-input"
              placeholder={t('adminMembers.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <span className="members-search-count">
                {filteredMembers.length}/{members.length}
              </span>
            )}
          </div>
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
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={5} className="members-no-results">{t('adminMembers.noResults')}</td>
                </tr>
              )}
              {filteredMembers.map(member => (
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
                  <td>{member.createdAt ? formatDateDDMMYYYY(member.createdAt) : t('common.na')}</td>
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
            {filteredMembers.length === 0 && (
              <p className="members-no-results">{t('adminMembers.noResults')}</p>
            )}
            {filteredMembers.map(member => (
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
                    {member.createdAt ? formatDateDDMMYYYY(member.createdAt) : t('common.na')}
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
          onClose={closeEditModal}
          title={t('adminMembers.editMember')}
        >
          <MemberEditForm
            member={selectedMember}
            t={t}
            onSubmit={handleSubmit}
            onCancel={closeEditModal}
          />
        </Modal>

        <Modal
          isOpen={isProfileModalOpen}
          onClose={closeProfileModal}
          title={profileModalTitle(profileModalMember, t)}
        >
          <MemberProfileBody
            member={profileModalMember}
            stats={profileStats}
            statsLoading={statsLoading}
            t={t}
            onEdit={handleEditFromProfile}
            onClose={closeProfileModal}
          />
        </Modal>
      </div>
    </Layout>
  )
}

export default AdminMembers
