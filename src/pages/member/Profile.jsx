import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import Layout from '../../components/Layout'
import Avatar from '../../components/Avatar'
import { updateMember } from '../../services/members'
import './Profile.css'

const MemberProfile = () => {
  const { userProfile, currentUser } = useAuth()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  const updateMutation = useMutation({
    mutationFn: ({ uid, data }) => updateMember(uid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['members'])
      setIsEditing(false)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const data = {
      displayName: formData.get('displayName'),
      email: formData.get('email')
    }
    updateMutation.mutate({ uid: currentUser.uid, data })
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

  return (
    <Layout>
      <div className="container">
        <h1 className="page-title">My Profile</h1>

        <div className="profile-card glass">
          <div className="profile-header">
            <Avatar 
              src={userProfile.photoURL} 
              name={userProfile.displayName}
              size="xl"
              className="profile-avatar"
            />
            <div className="profile-info">
              <h2 className="profile-name">{userProfile.displayName || 'N/A'}</h2>
              <p className="profile-email">{userProfile.email || 'N/A'}</p>
              <span className={`membership-badge ${userProfile.membershipType}`}>
                {userProfile.membershipType || 'member'}
              </span>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="profile-form">
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
              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-details">
              <div className="profile-detail-item">
                <span className="detail-label">Member Since</span>
                <span className="detail-value">
                  {userProfile.createdAt 
                    ? new Date(userProfile.createdAt).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div className="profile-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default MemberProfile
