import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const AVATAR_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/**
 * Validates if a file is a valid image
 * @param {File} file - The file to validate
 * @param {number} [maxSize=MAX_FILE_SIZE] - Max file size in bytes
 * @returns {Object} - { valid: boolean, error?: string }
 */
const validateImageFile = (file, maxSize = MAX_FILE_SIZE) => {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, or WebP images only.'
    }
  }

  if (file.size > maxSize) {
    const limitMB = (maxSize / 1024 / 1024).toFixed(0)
    return {
      valid: false,
      error: `File size exceeds ${limitMB}MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    }
  }

  return { valid: true }
}

/**
 * Uploads a photo for an amenity to Firebase Storage
 * @param {string} amenityId - The ID of the amenity
 * @param {File} file - The image file to upload
 * @param {Function} onProgress - Optional progress callback (progress: number) => void
 * @returns {Promise<string>} - The download URL of the uploaded photo
 */
export const uploadAmenityPhoto = async (amenityId, file, onProgress) => {
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  try {
    // Create a unique filename with timestamp
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `amenities/${amenityId}/${timestamp}-${sanitizedFilename}`
    
    const storageRef = ref(storage, storagePath)
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file)
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref)
    
    return downloadURL
  } catch (error) {
    console.error('Error uploading amenity photo:', error)
    throw new Error(`Failed to upload photo: ${error.message}`)
  }
}

/**
 * Deletes a photo from Firebase Storage
 * @param {string} photoUrl - The download URL of the photo to delete
 * @returns {Promise<void>}
 */
export const deleteAmenityPhoto = async (photoUrl) => {
  if (!photoUrl) {
    throw new Error('Photo URL is required')
  }

  try {
    // Extract the storage path from the URL
    // Firebase Storage URLs format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token={token}
    const url = new URL(photoUrl)
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/)
    
    if (!pathMatch) {
      throw new Error('Invalid photo URL format')
    }

    // Decode the path (Firebase encodes special characters)
    const storagePath = decodeURIComponent(pathMatch[1])
    const storageRef = ref(storage, storagePath)
    
    await deleteObject(storageRef)
  } catch (error) {
    console.error('Error deleting amenity photo:', error)
    throw new Error(`Failed to delete photo: ${error.message}`)
  }
}

/**
 * Uploads an avatar image for a member to Firebase Storage
 * @param {string} userId - The member's user ID
 * @param {File} file - The image file to upload
 * @returns {Promise<string>} - The download URL of the uploaded avatar
 */
export const uploadMemberAvatar = async (userId, file) => {
  const validation = validateImageFile(file, AVATAR_MAX_FILE_SIZE)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  try {
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `members/${userId}/avatar/${timestamp}-${sanitizedFilename}`

    const storageRef = ref(storage, storagePath)
    await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(storageRef)

    return downloadURL
  } catch (error) {
    console.error('Error uploading member avatar:', error)
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }
}

/**
 * Deletes a member avatar from Firebase Storage
 * @param {string} photoUrl - The download URL of the avatar to delete
 * @returns {Promise<void>}
 */
export const deleteMemberAvatar = async (photoUrl) => {
  if (!photoUrl) {
    throw new Error('Photo URL is required')
  }

  try {
    const url = new URL(photoUrl)
    const pathMatch = url.pathname.match(/\/o\/(.+)\?/)

    if (!pathMatch) {
      throw new Error('Invalid photo URL format')
    }

    const storagePath = decodeURIComponent(pathMatch[1])
    const storageRef = ref(storage, storagePath)
    await deleteObject(storageRef)
  } catch (error) {
    console.error('Error deleting member avatar:', error)
    throw new Error(`Failed to delete avatar: ${error.message}`)
  }
}

/**
 * Uploads multiple photos for an amenity
 * @param {string} amenityId - The ID of the amenity
 * @param {File[]} files - Array of image files to upload
 * @param {Function} onProgress - Optional progress callback (current: number, total: number) => void
 * @returns {Promise<string[]>} - Array of download URLs
 */
export const uploadMultipleAmenityPhotos = async (amenityId, files, onProgress) => {
  const uploadPromises = files.map(async (file, index) => {
    const url = await uploadAmenityPhoto(amenityId, file)
    if (onProgress) {
      onProgress(index + 1, files.length)
    }
    return url
  })

  return Promise.all(uploadPromises)
}
