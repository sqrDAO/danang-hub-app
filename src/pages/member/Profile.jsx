import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import Avatar from '../../components/Avatar'
import { updateMember, getMemberStats } from '../../services/members'
import { uploadMemberAvatar } from '../../services/storage'
import { showToast } from '../../components/Toast'
import './Profile.css'

const URL_PATTERN = /^https?:\/\/.+\..+/

const walletChainLabel = (address) =>
  address?.startsWith('0x') ? 'auth.ethereumWallet' : 'auth.solanaWallet'
const PHONE_PATTERN = /^[\d\s\-+()]+$/

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const validateProfileForm = (data, requireFields = false, t) => {
  if (requireFields) {
    if (!data.displayName?.trim()) return t('profile.validation.nameRequired')
    if (!data.email?.trim()) return t('profile.validation.emailRequired')
    if (!data.company?.trim()) return t('profile.validation.companyRequired')
    if (!data.jobTitle?.trim()) return t('profile.validation.jobTitleRequired')
  }
  if (data.linkedIn && data.linkedIn.trim() && !URL_PATTERN.test(data.linkedIn.trim())) {
    return t('profile.validation.invalidLinkedIn')
  }
  if (data.website && data.website.trim() && !URL_PATTERN.test(data.website.trim())) {
    return t('profile.validation.invalidWebsite')
  }
  if (data.phone && data.phone.trim() && !PHONE_PATTERN.test(data.phone.trim())) {
    return t('profile.validation.invalidPhone')
  }
  return null
}

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

const MemberProfile = () => {
  const { t, i18n } = useTranslation()
  const { userProfile, currentUser, refreshUserProfile, isProfileComplete } = useAuth()
  const locale = i18n.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  const location = useLocation()
  const queryClient = useQueryClient()
  const profileComplete = isProfileComplete()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const avatarInputRef = useRef(null)

  const copyAddress = async (addr) => {
    try {
      await navigator.clipboard.writeText(addr)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    } catch {
      showToast(t('profile.copyFailed'), 'error')
    }
  }

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['memberStats', currentUser?.uid],
    queryFn: () => getMemberStats(currentUser.uid),
    enabled: !!currentUser?.uid
  })

  const updateMutation = useMutation({
    mutationFn: ({ uid, data }) => updateMember(uid, data),
    onSuccess: async () => {
      if (typeof refreshUserProfile === 'function') {
        await refreshUserProfile()
      }
      queryClient.invalidateQueries(['members'])
      queryClient.invalidateQueries(['memberStats', currentUser?.uid])
      setIsEditing(false)
      setHasUnsavedChanges(false)
      showToast(t('toast.profileUpdated'), 'success')
    },
    onError: (error) => {
      showToast(error.message || t('toast.profileUpdateFailed'), 'error')
    }
  })

  const avatarMutation = useMutation({
    mutationFn: async ({ uid, file }) => {
      const photoURL = await uploadMemberAvatar(uid, file)
      await updateMember(uid, { photoURL })
      return photoURL
    },
    onSuccess: async () => {
      if (typeof refreshUserProfile === 'function') {
        await refreshUserProfile()
      }
      queryClient.invalidateQueries(['members'])
      showToast(t('toast.photoUpdated'), 'success')
    },
    onError: (error) => {
      showToast(error.message || t('toast.photoUpdateFailed'), 'error')
    }
  })

  useEffect(() => {
    if (!profileComplete && userProfile) {
      setIsEditing(true)
    }
  }, [profileComplete, userProfile])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && isEditing) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, isEditing])

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const preferences = {
      emailNotifications: formData.get('emailNotifications') === 'on',
      eventReminders: formData.get('eventReminders') === 'on'
    }
    const data = {
      displayName: formData.get('displayName')?.trim() || '',
      email: formData.get('email')?.trim() || '',
      phone: formData.get('phone')?.trim() || '',
      bio: formData.get('bio')?.trim() || '',
      company: formData.get('company')?.trim() || '',
      jobTitle: formData.get('jobTitle')?.trim() || '',
      linkedIn: formData.get('linkedIn')?.trim() || '',
      website: formData.get('website')?.trim() || '',
      preferences
    }
    const validationError = validateProfileForm(data, !profileComplete, t)
    if (validationError) {
      showToast(validationError, 'error')
      return
    }
    updateMutation.mutate({ uid: currentUser.uid, data })
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (file && currentUser?.uid) {
      avatarMutation.mutate({ uid: currentUser.uid, file })
    }
    e.target.value = ''
  }

  const handleFormChange = () => {
    setHasUnsavedChanges(true)
  }

  if (!userProfile) {
    return (
      <Layout>
        <div className="container">
          <div className="spinner"></div>
        </div>
      </Layout>
    )
  }

  const preferences = userProfile.preferences || {}
  const isUpdating = updateMutation.isPending
  const isAvatarUploading = avatarMutation.isPending

  return (
    <Layout isAdmin={isAdminRoute}>
      <div className="container">
        <h1 className="page-title">{t('profile.title')}</h1>

        {!profileComplete && (
          <div className="profile-complete-banner glass" role="alert">
            <p className="profile-complete-banner-text" dangerouslySetInnerHTML={{ __html: t('profile.completeBanner') }} />
          </div>
        )}

        <div className="profile-card glass">
          <div className="profile-header">
            <div className="profile-avatar-wrap">
              <Avatar
                src={userProfile.photoURL}
                name={userProfile.displayName}
                size="xl"
                className="profile-avatar"
              />
              {isAvatarUploading && <div className="profile-avatar-overlay"><span className="spinner"></span></div>}
              <label className="profile-avatar-upload">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={isAvatarUploading}
                  aria-label={t('profile.changePhoto')}
                />
                <span>{t('profile.changePhoto')}</span>
              </label>
            </div>
            <div className="profile-info">
              <h2 className="profile-name">{userProfile.displayName || 'N/A'}</h2>
              <p className="profile-email">{userProfile.email || 'N/A'}</p>
              <span className={`membership-badge ${userProfile.membershipType}`}>
                {userProfile.membershipType || 'member'}
              </span>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="profile-form" onChange={handleFormChange}>
              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.basicInfo')}</h3>
                <div className="form-group">
                  <label className="form-label">{t('profile.name')} {!profileComplete && <span className="form-required">*</span>}</label>
                  <input
                    type="text"
                    name="displayName"
                    className="form-field"
                    defaultValue={userProfile.displayName}
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('profile.email')} {!profileComplete && <span className="form-required">*</span>}</label>
                  <input
                    type="email"
                    name="email"
                    className="form-field"
                    defaultValue={userProfile.email}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('profile.phone')}</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-field"
                    defaultValue={userProfile.phone}
                    placeholder={t('profile.optional')}
                  />
                </div>
                {userProfile.walletAddress && (
                  <div className="form-group">
                    <label className="form-label">{t(walletChainLabel(userProfile.walletAddress))}</label>
                    <div className="wallet-address-field">
                      <input
                        type="text"
                        className="form-field wallet-address-input"
                        value={userProfile.walletAddress}
                        readOnly
                      />
                      <button
                        type="button"
                        className="wallet-copy-btn"
                        onClick={() => copyAddress(userProfile.walletAddress)}
                        title={t('profile.copyAddress')}
                      >
                        {copiedAddress ? t('profile.copied') : <CopyIcon />}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.professional')}</h3>
                <div className="form-group">
                  <label className="form-label">{t('profile.company')} {!profileComplete && <span className="form-required">*</span>}</label>
                  <input
                    type="text"
                    name="company"
                    className="form-field"
                    defaultValue={userProfile.company}
                    placeholder={profileComplete ? t('profile.optional') : 'Your company or organization'}
                    required={!profileComplete}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('profile.role')} {!profileComplete && <span className="form-required">*</span>}</label>
                  <input
                    type="text"
                    name="jobTitle"
                    className="form-field"
                    defaultValue={userProfile.jobTitle}
                    placeholder={profileComplete ? t('profile.optional') : 'Your job title or role'}
                    required={!profileComplete}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('profile.linkedIn')}</label>
                  <input
                    type="url"
                    name="linkedIn"
                    className="form-field"
                    defaultValue={userProfile.linkedIn}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('profile.website')}</label>
                  <input
                    type="url"
                    name="website"
                    className="form-field"
                    defaultValue={userProfile.website}
                    placeholder="https://..."
                  />
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.about')}</h3>
                <div className="form-group">
                  <label className="form-label">{t('profile.bio')}</label>
                  <textarea
                    name="bio"
                    className="form-field form-field-textarea"
                    defaultValue={userProfile.bio}
                    placeholder="A short bio about you"
                    rows={4}
                  />
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.preferences')}</h3>
                <div className="form-group form-group-checkbox">
                  <label className="form-label form-label-checkbox">
                    <input
                      type="checkbox"
                      name="emailNotifications"
                      defaultChecked={preferences.emailNotifications !== false}
                    />
                    <span>{t('profile.emailNotifications')}</span>
                  </label>
                </div>
                <div className="form-group form-group-checkbox">
                  <label className="form-label form-label-checkbox">
                    <input
                      type="checkbox"
                      name="eventReminders"
                      defaultChecked={preferences.eventReminders !== false}
                    />
                    <span>{t('profile.eventReminders')}</span>
                  </label>
                </div>
              </section>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isUpdating}>
                  {isUpdating ? t('profile.saving') : t('common.save')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsEditing(false)
                    setHasUnsavedChanges(false)
                  }}
                  disabled={isUpdating}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <>
              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.basicInfo')}</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.displayName')}</span>
                  <span className="detail-value">{userProfile.displayName || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.email')}</span>
                  <span className="detail-value">{userProfile.email || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.phone')}</span>
                  <span className="detail-value">{userProfile.phone || '—'}</span>
                </div>
                {userProfile.walletAddress && (
                  <div className="profile-detail-item profile-detail-wallet">
                    <span className="detail-label">{t(walletChainLabel(userProfile.walletAddress))}</span>
                    <span className="detail-value wallet-address-display">
                      <span className="wallet-address-text">{userProfile.walletAddress}</span>
                      <button
                        className="wallet-copy-btn"
                        onClick={() => copyAddress(userProfile.walletAddress)}
                        title={t('profile.copyAddress')}
                      >
                        {copiedAddress ? t('profile.copied') : <CopyIcon />}
                      </button>
                    </span>
                  </div>
                )}
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.professional')}</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.company')}</span>
                  <span className="detail-value">{userProfile.company || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.role')}</span>
                  <span className="detail-value">{userProfile.jobTitle || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.linkedIn')}</span>
                  <span className="detail-value">
                    {userProfile.linkedIn ? (
                      <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {userProfile.linkedIn}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.website')}</span>
                  <span className="detail-value">
                    {userProfile.website ? (
                      <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {userProfile.website}
                      </a>
                    ) : '—'}
                  </span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.about')}</h3>
                <div className="profile-detail-item profile-detail-bio">
                  <span className="detail-label">{t('profile.bio')}</span>
                  <span className="detail-value">{userProfile.bio || '—'}</span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">{t('profile.preferences')}</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.emailNotifications')}</span>
                  <span className="detail-value">{preferences.emailNotifications !== false ? t('common.on') : t('common.off')}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">{t('profile.eventReminders')}</span>
                  <span className="detail-value">{preferences.eventReminders !== false ? t('common.on') : t('common.off')}</span>
                </div>
              </section>

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
                    {userProfile.createdAt
                      ? `${new Date(userProfile.createdAt).toLocaleDateString(locale)} (${formatMemberSince(userProfile.createdAt, t)})`
                      : t('common.na')}
                  </span>
                </div>
              </section>

              <div className="profile-actions">
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  {t('profile.editProfile')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default MemberProfile
