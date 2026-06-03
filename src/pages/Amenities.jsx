import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import AuthPrompt from '../components/AuthPrompt'
import { getAmenities } from '../services/amenities'
import './Amenities.css'

const Amenities = () => {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [expandedPhotoIndex, setExpandedPhotoIndex] = useState({})

  const { data: amenities = [], isLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const handleBookAmenity = (amenity) => {
    if (!currentUser) {
      setSelectedAmenity(amenity)
      setAuthPromptOpen(true)
    } else if (amenity.type === 'event-space') {
      navigate(`/member/events?action=create&amenityId=${amenity.id}`)
    } else {
      navigate(`/member/bookings?amenityId=${amenity.id}`)
    }
  }

  const handleLogin = () => {
    if (selectedAmenity) {
      const loginUrl = selectedAmenity.type === 'event-space'
        ? `/login?redirect=/member/events&action=create&amenityId=${selectedAmenity.id}`
        : `/login?redirect=/member/bookings&amenityId=${selectedAmenity.id}`
      navigate(loginUrl)
    } else {
      navigate('/login?redirect=/member/bookings')
    }
  }

  const handleSignUp = () => {
    if (selectedAmenity) {
      const loginUrl = selectedAmenity.type === 'event-space'
        ? `/login?signup=true&redirect=/member/events&action=create&amenityId=${selectedAmenity.id}`
        : `/login?signup=true&redirect=/member/bookings&amenityId=${selectedAmenity.id}`
      navigate(loginUrl)
    } else {
      navigate('/login?signup=true&redirect=/member/bookings')
    }
  }

  const availableAmenities = amenities.filter(a => a.isAvailable !== false)

  return (
    <Layout public>
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Amenities</h1>
          <p className="page-subtitle">Browse available workspace amenities and facilities</p>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <p>Loading amenities...</p>
          </div>
        ) : availableAmenities.length > 0 ? (
          <div className="amenities-grid">
            {availableAmenities.map(amenity => (
              <div key={amenity.id} className="amenity-card glass">
                {amenity.photos && amenity.photos.length > 0 ? (
                  <div className="amenity-photo-gallery">
                    <div className="amenity-photo-main">
                      <img 
                        src={amenity.photos[expandedPhotoIndex[amenity.id] || 0]} 
                        alt={amenity.name}
                      />
                      {amenity.photos.length > 1 && (
                        <>
                          <button
                            className="photo-nav-btn photo-nav-prev"
                            onClick={() => {
                              const current = expandedPhotoIndex[amenity.id] || 0
                              const prev = current === 0 ? amenity.photos.length - 1 : current - 1
                              setExpandedPhotoIndex({ ...expandedPhotoIndex, [amenity.id]: prev })
                            }}
                            aria-label="Previous photo"
                          >
                            ‹
                          </button>
                          <button
                            className="photo-nav-btn photo-nav-next"
                            onClick={() => {
                              const current = expandedPhotoIndex[amenity.id] || 0
                              const next = (current + 1) % amenity.photos.length
                              setExpandedPhotoIndex({ ...expandedPhotoIndex, [amenity.id]: next })
                            }}
                            aria-label="Next photo"
                          >
                            ›
                          </button>
                          <div className="photo-indicator">
                            {(expandedPhotoIndex[amenity.id] || 0) + 1} / {amenity.photos.length}
                          </div>
                        </>
                      )}
                    </div>
                    {amenity.photos.length > 1 && (
                      <div className="amenity-photo-thumbnails">
                        {amenity.photos.map((photo, index) => (
                          <button
                            key={index}
                            className={`photo-thumbnail ${(expandedPhotoIndex[amenity.id] || 0) === index ? 'active' : ''}`}
                            onClick={() => setExpandedPhotoIndex({ ...expandedPhotoIndex, [amenity.id]: index })}
                          >
                            <img src={photo} alt={`${amenity.name} ${index + 1}`} loading="lazy" decoding="async" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="amenity-photo-placeholder">
                    <span>No photo available</span>
                  </div>
                )}
                <div className="amenity-header">
                  <h3 className="amenity-name">{amenity.name}</h3>
                  <span className="amenity-type">{amenity.type}</span>
                </div>
                <div className="amenity-info">
                  {amenity.capacity && (
                    <p className="amenity-capacity">Capacity: {amenity.capacity}</p>
                  )}
                  {amenity.description && (
                    <p className="amenity-description">{amenity.description}</p>
                  )}
                  <div className="amenity-status">
                    <span className="status-badge available">Available</span>
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-full-width"
                  onClick={() => handleBookAmenity(amenity)}
                >
                  📅 Book Now
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No amenities available at this time</p>
          </div>
        )}

        <AuthPrompt
          isOpen={authPromptOpen}
          onClose={() => {
            setAuthPromptOpen(false)
            setSelectedAmenity(null)
          }}
          action="book"
          onLogin={handleLogin}
          onSignUp={handleSignUp}
        />
      </div>
    </Layout>
  )
}

export default Amenities
