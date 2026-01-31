import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import Avatar from '../../components/Avatar'
import { updateMember, getMemberStats } from '../../services/members'
import { uploadMemberAvatar } from '../../services/storage'
import { showToast } from '../../components/Toast'
import './Profile.css'

const URL_PATTERN = /^https?:\/\/.+\..+/
const PHONE_PATTERN = /^[\d\s\-+()]+$/

const validateProfileForm = (data) => {
  if (data.linkedIn && data.linkedIn.trim() && !URL_PATTERN.test(data.linkedIn.trim())) {
    return 'LinkedIn must be a valid URL'
  }
  if (data.website && data.website.trim() && !URL_PATTERN.test(data.website.trim())) {
    return 'Website must be a valid URL'
  }
  if (data.phone && data.phone.trim() && !PHONE_PATTERN.test(data.phone.trim())) {
    return 'Phone can only contain digits, spaces, dashes, plus sign, and parentheses'
  }
  return null
}

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

const MemberProfile = () => {
  const { userProfile, currentUser, refreshUserProfile } = useAuth()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const avatarInputRef = useRef(null)

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
      showToast('Profile updated successfully', 'success')
    },
    onError: (error) => {
      showToast(error.message || 'Failed to update profile', 'error')
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
      showToast('Photo updated successfully', 'success')
    },
    onError: (error) => {
      showToast(error.message || 'Failed to update photo', 'error')
    }
  })

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
    const validationError = validateProfileForm(data)
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
    <Layout>
      <div className="container">
        <h1 className="page-title">My Profile</h1>

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
                  aria-label="Change profile photo"
                />
                <span>Change photo</span>
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
                <h3 className="profile-section-title">Basic Info</h3>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input
                    type="text"
                    name="displayName"
                    className="form-field"
                    defaultValue={userProfile.displayName}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="email"
                    className="form-field"
                    defaultValue={userProfile.email}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-field"
                    defaultValue={userProfile.phone}
                    placeholder="Optional"
                  />
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">Professional</h3>
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <input
                    type="text"
                    name="company"
                    className="form-field"
                    defaultValue={userProfile.company}
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Title</label>
                  <input
                    type="text"
                    name="jobTitle"
                    className="form-field"
                    defaultValue={userProfile.jobTitle}
                    placeholder="Optional"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">LinkedIn</label>
                  <input
                    type="url"
                    name="linkedIn"
                    className="form-field"
                    defaultValue={userProfile.linkedIn}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Website</label>
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
                <h3 className="profile-section-title">About</h3>
                <div className="form-group">
                  <label className="form-label">Bio</label>
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
                <h3 className="profile-section-title">Preferences</h3>
                <div className="form-group form-group-checkbox">
                  <label className="form-label form-label-checkbox">
                    <input
                      type="checkbox"
                      name="emailNotifications"
                      defaultChecked={preferences.emailNotifications !== false}
                    />
                    <span>Email notifications</span>
                  </label>
                </div>
                <div className="form-group form-group-checkbox">
                  <label className="form-label form-label-checkbox">
                    <input
                      type="checkbox"
                      name="eventReminders"
                      defaultChecked={preferences.eventReminders !== false}
                    />
                    <span>Event reminders</span>
                  </label>
                </div>
              </section>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isUpdating}>
                  {isUpdating ? 'Saving…' : 'Save Changes'}
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
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <section className="profile-section">
                <h3 className="profile-section-title">Basic Info</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Display Name</span>
                  <span className="detail-value">{userProfile.displayName || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Email</span>
                  <span className="detail-value">{userProfile.email || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Phone</span>
                  <span className="detail-value">{userProfile.phone || '—'}</span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">Professional</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Company</span>
                  <span className="detail-value">{userProfile.company || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Job Title</span>
                  <span className="detail-value">{userProfile.jobTitle || '—'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">LinkedIn</span>
                  <span className="detail-value">
                    {userProfile.linkedIn ? (
                      <a href={userProfile.linkedIn} target="_blank" rel="noopener noreferrer" className="profile-link">
                        {userProfile.linkedIn}
                      </a>
                    ) : '—'}
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Website</span>
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
                <h3 className="profile-section-title">About</h3>
                <div className="profile-detail-item profile-detail-bio">
                  <span className="detail-label">Bio</span>
                  <span className="detail-value">{userProfile.bio || '—'}</span>
                </div>
              </section>

              <section className="profile-section">
                <h3 className="profile-section-title">Preferences</h3>
                <div className="profile-detail-item">
                  <span className="detail-label">Email notifications</span>
                  <span className="detail-value">{preferences.emailNotifications !== false ? 'On' : 'Off'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="detail-label">Event reminders</span>
                  <span className="detail-value">{preferences.eventReminders !== false ? 'On' : 'Off'}</span>
                </div>
              </section>

              <section className="profile-section profile-section-activity">
                <h3 className="profile-section-title">Activity</h3>
                {statsLoading ? (
                  <div className="profile-stats-loading">Loading…</div>
                ) : stats ? (
                  <div className="profile-stats">
                    <div className="profile-stat">
                      <span className="profile-stat-value">{stats.totalBookings}</span>
                      <span className="profile-stat-label">Bookings</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{stats.eventsAttended}</span>
                      <span className="profile-stat-label">Events attended</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{stats.eventsOrganized}</span>
                      <span className="profile-stat-label">Events organized</span>
                    </div>
                  </div>
                ) : null}
                <div className="profile-detail-item">
                  <span className="detail-label">Member since</span>
                  <span className="detail-value">
                    {userProfile.createdAt
                      ? `${new Date(userProfile.createdAt).toLocaleDateString()} (${formatMemberSince(userProfile.createdAt)})`
                      : 'N/A'}
                  </span>
                </div>
              </section>

              <div className="profile-actions">
                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  Edit Profile
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
