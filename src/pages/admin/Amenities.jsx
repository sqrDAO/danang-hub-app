import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import Modal from '../../components/Modal'
import AmenityPhotoLightbox from '../../components/AmenityPhotoLightbox'
import { getAmenities, createAmenity, updateAmenity, deleteAmenity, DEFAULT_AVAILABILITY, EVENT_SPACE_AVAILABILITY, getDefaultAvailability, DEFAULT_CAPACITY_BY_TYPE } from '../../services/amenities'
import { uploadAmenityPhoto, deleteAmenityPhoto } from '../../services/storage'
import { showToast } from '../../components/Toast'
import './Amenities.css'

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

const AdminAmenities = () => {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(true)
  const [selectedAmenity, setSelectedAmenity] = useState(null)
  const [availableDays, setAvailableDays] = useState(DEFAULT_AVAILABILITY.availableDays)
  const [photos, setPhotos] = useState([])
  const [pendingFiles, setPendingFiles] = useState([]) // Files waiting to be uploaded (create mode)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [lightboxAmenity, setLightboxAmenity] = useState(null)
  const fileInputRef = useRef(null)
  const capacityInputRef = useRef(null)
  const startHourRef = useRef(null)
  const endHourRef = useRef(null)
  const queryClient = useQueryClient()

  const handleTypeChange = (e) => {
    const type = e.target.value
    const defaultCap = DEFAULT_CAPACITY_BY_TYPE[type] ?? 1
    if (capacityInputRef.current) {
      capacityInputRef.current.value = defaultCap
    }
    const avail = getDefaultAvailability(type)
    if (startHourRef.current) startHourRef.current.value = avail.startHour
    if (endHourRef.current) endHourRef.current.value = avail.endHour
    setAvailableDays(avail.availableDays)
  }

  const { data: amenities = [], isLoading } = useQuery({
    queryKey: ['amenities'],
    queryFn: getAmenities
  })

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // First create the amenity to get the ID
      const amenityId = await createAmenity(data)
      
      // Then upload pending photos if any
      // In create mode, photos array contains only preview URLs (blob: URLs)
      // and pendingFiles contains the corresponding File objects in the same order
      if (pendingFiles.length > 0) {
        setUploadingPhotos(true)
        const uploadedPhotos = []
        try {
          // Upload all pending files
          for (let i = 0; i < pendingFiles.length; i++) {
            const file = pendingFiles[i]
            const downloadURL = await uploadAmenityPhoto(amenityId, file)
            uploadedPhotos.push(downloadURL)
            
            // Revoke the corresponding preview URL
            // In create mode, photos array should only contain preview URLs
            // and they should be in the same order as pendingFiles
            if (i < photos.length) {
              const previewUrl = photos[i]
              if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl)
              }
            }
          }
          
          // Update the amenity with photo URLs
          if (uploadedPhotos.length > 0) {
            await updateAmenity(amenityId, { photos: uploadedPhotos })
          }
        } catch (error) {
          showToast(`Amenity created but some photos failed to upload: ${error.message}`, 'error')
        } finally {
          setUploadingPhotos(false)
        }
      }
      
      return amenityId
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['amenities'])
      setIsModalOpen(false)
      resetForm()
      showToast('Amenity created successfully!', 'success')
    },
    onError: () => {
      showToast('Failed to create amenity. Please try again.', 'error')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateAmenity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['amenities'])
      setIsModalOpen(false)
      resetForm()
      showToast('Amenity updated successfully!', 'success')
    },
    onError: () => {
      showToast('Failed to update amenity. Please try again.', 'error')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAmenity,
    onSuccess: () => {
      queryClient.invalidateQueries(['amenities'])
      showToast('Amenity deleted successfully!', 'success')
    }
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }) => updateAmenity(id, { isAvailable }),
    onSuccess: () => {
      queryClient.invalidateQueries(['amenities'])
      showToast('Availability updated!', 'success')
    }
  })

  const resetForm = () => {
    setSelectedAmenity(null)
    setIsCreateMode(true)
    setAvailableDays(DEFAULT_AVAILABILITY.availableDays)
    setPhotos([])
    setPendingFiles([])
    setUploadingPhotos(false)
    setUploadProgress({})
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCreate = () => {
    setIsCreateMode(true)
    setSelectedAmenity(null)
    setAvailableDays(DEFAULT_AVAILABILITY.availableDays)
    setPhotos([])
    setPendingFiles([])
    setUploadingPhotos(false)
    setUploadProgress({})
    setIsModalOpen(true)
  }

  const handleEdit = (amenity) => {
    setIsCreateMode(false)
    setSelectedAmenity(amenity)
    setAvailableDays(amenity.availableDays || getDefaultAvailability(amenity.type).availableDays)
    setPhotos(amenity.photos || [])
    setPendingFiles([])
    setUploadingPhotos(false)
    setUploadProgress({})
    setIsModalOpen(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this amenity?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleToggleAvailability = (id, currentStatus) => {
    toggleAvailabilityMutation.mutate({ id, isAvailable: !currentStatus })
  }

  const handleDayToggle = (dayValue) => {
    if (availableDays.includes(dayValue)) {
      setAvailableDays(availableDays.filter(d => d !== dayValue))
    } else {
      setAvailableDays([...availableDays, dayValue].sort())
    }
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // In create mode, store files temporarily. In edit mode, upload immediately
    if (isCreateMode) {
      setPendingFiles(prev => [...prev, ...files])
      // Create preview URLs for immediate display
      const previewUrls = files.map(file => URL.createObjectURL(file))
      setPhotos(prev => [...prev, ...previewUrls])
    } else {
      // Edit mode: upload immediately since we have the amenity ID
      setUploadingPhotos(true)
      const newPhotos = [...photos]
      const newProgress = { ...uploadProgress }

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const fileId = `${Date.now()}-${i}`
          newProgress[fileId] = 0

          try {
            const downloadURL = await uploadAmenityPhoto(selectedAmenity.id, file, (progress) => {
              setUploadProgress(prev => ({ ...prev, [fileId]: progress }))
            })
            newPhotos.push(downloadURL)
            delete newProgress[fileId]
          } catch (error) {
            showToast(`Failed to upload ${file.name}: ${error.message}`, 'error')
            delete newProgress[fileId]
          }
        }

        setPhotos(newPhotos)
        setUploadProgress(newProgress)
      } catch (error) {
        showToast('Error uploading photos', 'error')
      } finally {
        setUploadingPhotos(false)
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePhotoDelete = async (photoUrl, index) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return
    }

    try {
      if (isCreateMode) {
        // In create mode, check if this is a preview URL (starts with blob:)
        const isPreview = photoUrl.startsWith('blob:')
        
        if (isPreview) {
          // Revoke the object URL
          URL.revokeObjectURL(photoUrl)
          // Remove from both photos and pendingFiles arrays
          const newPhotos = photos.filter((_, i) => i !== index)
          setPhotos(newPhotos)
          
          // Find the corresponding file index (photos array includes existing + new previews)
          // We need to figure out which pending file corresponds to this preview
          const existingPhotoCount = photos.length - pendingFiles.length
          const pendingFileIndex = index - existingPhotoCount
          
          if (pendingFileIndex >= 0 && pendingFileIndex < pendingFiles.length) {
            const newPendingFiles = pendingFiles.filter((_, i) => i !== pendingFileIndex)
            setPendingFiles(newPendingFiles)
          }
        } else {
          // It's an existing photo URL, just remove from display
          const newPhotos = photos.filter((_, i) => i !== index)
          setPhotos(newPhotos)
        }
      } else {
        const newPhotos = photos.filter((_, i) => i !== index)
        setPhotos(newPhotos)

        if (selectedAmenity?.id) {
          await updateAmenity(selectedAmenity.id, { photos: newPhotos })
          try {
            await deleteAmenityPhoto(photoUrl)
          } catch (storageError) {
            console.error('Photo removed from amenity but storage delete failed:', storageError)
          }
          queryClient.invalidateQueries(['amenities'])
        }
      }
    } catch (error) {
      showToast('Failed to delete photo. Please try again.', 'error')
      setPhotos(photos)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (uploadingPhotos) {
      showToast('Please wait for photos to finish uploading', 'error')
      return
    }

    const formData = new FormData(e.target)
    const data = {
      name: formData.get('name'),
      type: formData.get('type'),
      capacity: parseInt(formData.get('capacity')) || 1,
      description: formData.get('description'),
      isAvailable: formData.get('isAvailable') === 'true',
      startHour: parseInt(formData.get('startHour')) || DEFAULT_AVAILABILITY.startHour,
      endHour: parseInt(formData.get('endHour')) || DEFAULT_AVAILABILITY.endHour,
      slotDuration: parseInt(formData.get('slotDuration')) || DEFAULT_AVAILABILITY.slotDuration,
      availableDays: availableDays,
      photos: isCreateMode ? [] : photos // In create mode, photos will be uploaded after creation
    }

    if (isCreateMode) {
      createMutation.mutate(data)
    } else {
      updateMutation.mutate({ id: selectedAmenity.id, data })
    }
  }

  const formatAvailableDays = (days) => {
    if (!days || days.length === 0) return t('adminAmenities.daysNone')
    if (days.length === 7) return t('adminAmenities.daysEveryDay')
    if (JSON.stringify([...days].sort()) === JSON.stringify([1, 2, 3, 4, 5])) return t('adminAmenities.daysMonFri')
    return days.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label.slice(0, 3)).join(', ')
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
          <h1 className="page-title">{t('adminAmenities.title')}</h1>
          <button className="btn btn-primary" onClick={handleCreate}>
            + {t('adminAmenities.addButton')}
          </button>
        </div>

        <div className="amenities-grid">
          {amenities.map(amenity => (
            <div key={amenity.id} className="amenity-card glass">
              {amenity.photos && amenity.photos.length > 0 && (
                <button
                  type="button"
                  className="amenity-photo-preview amenity-photo-clickable"
                  onClick={() => setLightboxAmenity(amenity)}
                  aria-label={`View photos of ${amenity.name}`}
                >
                  <img src={amenity.photos[0]} alt={amenity.name} />
                  {amenity.photos.length > 1 && (
                    <span className="photo-count-badge">{t('adminAmenities.photos', { count: amenity.photos.length })}</span>
                  )}
                </button>
              )}
              <div className="amenity-header">
                <h3 className="amenity-name">{amenity.name}</h3>
                <span className={`availability-badge ${amenity.isAvailable !== false ? 'available' : 'unavailable'}`}>
                  {amenity.isAvailable !== false ? t('status.available') : t('status.unavailable')}
                </span>
              </div>
              <div className="amenity-info">
                <p className="amenity-type">{t('adminAmenities.type', { type: amenity.type || t('common.na') })}</p>
                <p className="amenity-capacity">{t('adminAmenities.capacity', { count: amenity.capacity ?? t('common.na') })}</p>
                <p className="amenity-hours">
                  {t('adminAmenities.hours', {
                    start: amenity.startHour ?? DEFAULT_AVAILABILITY.startHour,
                    end: amenity.endHour ?? DEFAULT_AVAILABILITY.endHour
                  })}
                </p>
                <p className="amenity-days">
                  {t('adminAmenities.days', { days: formatAvailableDays(amenity.availableDays || DEFAULT_AVAILABILITY.availableDays) })}
                </p>
                <p className="amenity-slot">
                  {t('adminAmenities.slot', { duration: amenity.slotDuration ?? DEFAULT_AVAILABILITY.slotDuration })}
                </p>
                {amenity.description && (
                  <p className="amenity-description">{amenity.description}</p>
                )}
              </div>
              <div className="amenity-actions">
                <button
                  className={`btn ${amenity.isAvailable !== false ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => handleToggleAvailability(amenity.id, amenity.isAvailable !== false)}
                >
                  {amenity.isAvailable !== false ? t('adminAmenities.markUnavailable') : t('adminAmenities.markAvailable')}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleEdit(amenity)}
                >
                  {t('common.edit')}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(amenity.id)}
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            resetForm()
          }}
          title={isCreateMode ? t('adminAmenities.modal.createTitle') : t('adminAmenities.modal.editTitle')}
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('adminAmenities.form.name')}</label>
              <input
                type="text"
                name="name"
                className="form-field"
                defaultValue={selectedAmenity?.name || ''}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('adminAmenities.form.type')}</label>
              <select name="type" className="form-field" defaultValue={selectedAmenity?.type || ''} onChange={handleTypeChange} required>
                <option value="">{t('adminAmenities.form.typePlaceholder')}</option>
                <option value="desk">{t('adminAmenities.form.typeDesk')}</option>
                <option value="meeting-room">{t('adminAmenities.form.typeMeetingRoom')}</option>
                <option value="podcast-room">{t('adminAmenities.form.typePodcastRoom')}</option>
                <option value="event-space">{t('adminAmenities.form.typeEventSpace')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('adminAmenities.form.capacity')}</label>
              <input
                ref={capacityInputRef}
                type="number"
                name="capacity"
                className="form-field"
                defaultValue={selectedAmenity?.capacity ?? DEFAULT_CAPACITY_BY_TYPE[selectedAmenity?.type] ?? 1}
                min="1"
                required
              />
              <small className="form-hint">
                {t('adminAmenities.form.capacityHint')}
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">{t('adminAmenities.form.description')}</label>
              <textarea
                name="description"
                className="form-field"
                defaultValue={selectedAmenity?.description || ''}
                rows="3"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('adminAmenities.form.photos')}</label>
              <div className="photo-upload-section">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoUpload}
                  className="photo-input"
                  disabled={uploadingPhotos}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-upload"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                >
                  {uploadingPhotos ? t('adminAmenities.form.uploading') : t('adminAmenities.form.uploadButton')}
                </button>
                {uploadingPhotos && Object.keys(uploadProgress).length > 0 && (
                  <div className="upload-progress">
                    {t('adminAmenities.form.uploading')}
                  </div>
                )}
              </div>
              
              {photos.length > 0 && (
                <div className="photo-preview-grid">
                  {photos.map((photoUrl, index) => (
                    <div key={index} className="photo-preview-item">
                      <img src={photoUrl} alt={t('adminAmenities.form.photoAlt', { index: index + 1 })} />
                      <button
                        type="button"
                        className="photo-delete-btn"
                        onClick={() => handlePhotoDelete(photoUrl, index)}
                        disabled={uploadingPhotos}
                        title={t('adminAmenities.form.deletePhoto')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-section">
              <h4 className="form-section-title">
                {t('adminAmenities.form.availabilityTitle')}
              </h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    {t('adminAmenities.form.openFrom')}
                  </label>
                  <select
                    ref={startHourRef}
                    name="startHour"
                    className="form-field"
                    defaultValue={selectedAmenity?.startHour ?? getDefaultAvailability(selectedAmenity?.type).startHour}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {t('adminAmenities.form.closeAt')}
                  </label>
                  <select
                    ref={endHourRef}
                    name="endHour"
                    className="form-field"
                    defaultValue={selectedAmenity?.endHour ?? getDefaultAvailability(selectedAmenity?.type).endHour}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {t('adminAmenities.form.slotDuration')}
                </label>
                <select
                  name="slotDuration"
                  className="form-field"
                  defaultValue={selectedAmenity?.slotDuration ?? getDefaultAvailability(selectedAmenity?.type).slotDuration}
                >
                  <option value="15">{t('adminAmenities.form.slot15')}</option>
                  <option value="30">{t('adminAmenities.form.slot30')}</option>
                  <option value="60">{t('adminAmenities.form.slot60')}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {t('adminAmenities.form.availableDays')}
                </label>
                <div className="days-selector">
                  {DAYS_OF_WEEK.map(day => (
                    <label key={day.value} className={`day-checkbox ${availableDays.includes(day.value) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={availableDays.includes(day.value)}
                        onChange={() => handleDayToggle(day.value)}
                      />
                      <span>{day.label.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('adminAmenities.statusLabel')}</label>
              <select name="isAvailable" className="form-field" defaultValue={selectedAmenity?.isAvailable !== false ? 'true' : 'false'}>
                <option value="true">{t('status.available')}</option>
                <option value="false">{t('status.unavailable')}</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {isCreateMode ? t('common.create') : t('common.save')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </Modal>

        <AmenityPhotoLightbox
          isOpen={!!lightboxAmenity}
          onClose={() => setLightboxAmenity(null)}
          photos={lightboxAmenity?.photos || []}
          alt={lightboxAmenity?.name || ''}
        />
      </div>
    </Layout>
  )
}

export default AdminAmenities
