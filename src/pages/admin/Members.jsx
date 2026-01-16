import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import { getMembers, updateMember, deleteMember } from '../../services/members'
import './Members.css'

const AdminMembers = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const queryClient = useQueryClient()

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: getMembers
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
      </div>
    </Layout>
  )
}

export default AdminMembers
