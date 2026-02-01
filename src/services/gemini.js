// Gemini AI service for chatbot

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
// Using gemini-2.5-flash (stable model) - see https://ai.google.dev/gemini-api/docs/models
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const buildSystemInstruction = (memberId) => {
  const now = new Date()
  const nowVietnam = now.toLocaleString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const todayISO = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const authStatus = memberId
    ? 'The user is LOGGED IN. You may call create_booking for them – do not ask them to log in.'
    : 'The user is NOT logged in. Do not call create_booking; inform them they need to log in to create bookings.'

  return `You are a helpful assistant for Da Nang Blockchain Hub. 
${authStatus}

Current date/time in Vietnam (Asia/Ho_Chi_Minh): ${nowVietnam}. Today's date (YYYY-MM-DD): ${todayISO}. 
When the user says "next Monday", "tomorrow", "this Friday", etc., compute the actual date from the current date and convert to ISO format (e.g. 2026-02-03T08:00:00) for check_availability and create_booking. Do NOT ask the user for the specific date – compute it yourself.

You help members with:
- Booking amenities (desks, meeting rooms, podcast rooms, event spaces)
- Finding available time slots
- Event information
- General questions about the hub

The hub has an Event Space (Main Hall) that accommodates up to 80 people. Use list_amenities with minCapacity to find it for workshops and events.

Desks, meeting rooms, and podcast rooms are only available Mon–Fri, 8 AM–6 PM (Vietnam time). Event Space can be booked for evening events. If check_availability returns an error about business hours, suggest weekday times within 8 AM–6 PM.

Event Hall requires booking at least 2 weeks in advance. If check_availability returns an error with minBookableDate, use that exact date when suggesting alternatives (e.g. "The earliest you can book is [minBookableDate]. Would you like to check availability for a date on or after that?"). Do not calculate the date yourself - always use minBookableDate from the tool response.

IMPORTANT: When users ask to check availability or book event spaces, you MUST use the provided tools (list_amenities, check_availability, create_booking) to perform these actions. Do NOT just say you will check - actually call the tools and report the real results.

For event/workshop booking: First use list_amenities with minCapacity set to the attendee count (e.g. 50 for 50 people) to find suitable spaces. The Event Space holds up to 80. Then use check_availability for each suitable space, then use create_booking when the user confirms.

Be friendly, concise, and helpful.
Use proper markdown formatting: put list items on separate lines (each starting with * and a space), use **bold** for emphasis.`
}

const FUNCTION_DECLARATIONS = [
  {
    name: 'list_amenities',
    description: 'List all available amenities (desks, meeting rooms, podcast rooms, event spaces) at the hub. Use this to find spaces suitable for events - filter by capacity for the number of attendees.',
    parameters: {
      type: 'object',
      properties: {
        minCapacity: {
          type: 'integer',
          description: 'Optional. Minimum capacity needed. Use for events - e.g. 50 for a 50-person workshop.'
        },
        type: {
          type: 'string',
          description: 'Optional. Filter by amenity type: desk, meeting-room, podcast-room, event-space (Event Space / Main Hall holds up to 80 people)'
        }
      }
    }
  },
  {
    name: 'check_availability',
    description: 'Check if a specific amenity is available for a given date and time range. Call this after list_amenities to verify the slot is free before booking.',
    parameters: {
      type: 'object',
      properties: {
        amenityId: {
          type: 'string',
          description: 'The ID of the amenity to check (from list_amenities)'
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO 8601 format, e.g. 2026-02-19T18:00:00'
        },
        endTime: {
          type: 'string',
          description: 'End time in ISO 8601 format, e.g. 2026-02-19T21:00:00'
        }
      },
      required: ['amenityId', 'startTime', 'endTime']
    }
  },
  {
    name: 'create_booking',
    description: 'Create a booking for an amenity. User must be logged in. Call this only after confirming availability and when the user has approved the booking.',
    parameters: {
      type: 'object',
      properties: {
        amenityId: {
          type: 'string',
          description: 'The ID of the amenity to book'
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO 8601 format'
        },
        endTime: {
          type: 'string',
          description: 'End time in ISO 8601 format'
        }
      },
      required: ['amenityId', 'startTime', 'endTime']
    }
  }
]

const buildContents = (conversationHistory, latestMessage) => {
  const contents = []
  conversationHistory.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    })
  })
  contents.push({
    role: 'user',
    parts: [{ text: latestMessage }]
  })
  return contents
}

const extractFunctionCall = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts || []
  const part = parts.find(p => p.functionCall)
  return part?.functionCall
}

const extractText = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts || []
  const textParts = parts.filter(p => p.text).map(p => p.text)
  return textParts.join('\n').trim() || null
}

export const chatWithGemini = async (message, conversationHistory = []) => {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not configured')
    return 'AI assistant is not available. Please configure your Gemini API key.'
  }

  try {
    const contents = buildContents(conversationHistory, message)
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: buildSystemInstruction() }] }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      throw new Error(`Gemini API request failed: ${response.status}`)
    }

    const data = await response.json()
    return extractText(data) || 'Sorry, I could not process your request.'
  } catch (error) {
    console.error('Error chatting with Gemini:', error)
    return 'Sorry, I encountered an error. Please try again later.'
  }
}

/**
 * Agent version with function calling - can check availability and create bookings
 * @param {string} message - User message
 * @param {Array} conversationHistory - [{role, content}]
 * @param {Object} toolImplementations - { listAmenities, checkAvailability, createBooking }
 * @param {string} memberId - Current user's ID (required for create_booking)
 */
export const chatWithGeminiAgent = async (
  message,
  conversationHistory = [],
  toolImplementations,
  memberId
) => {
  if (!GEMINI_API_KEY) {
    return 'AI assistant is not available. Please configure your Gemini API key.'
  }

  const { listAmenities, checkAvailability, createBooking } = toolImplementations || {}
  let contents = buildContents(conversationHistory, message)
  const maxIterations = 10
  let iteration = 0

  try {
    while (iteration < maxIterations) {
      const requestBody = {
        contents,
        systemInstruction: { parts: [{ text: buildSystemInstruction(memberId) }] },
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }]
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error:', response.status, errorText)
        throw new Error(`Gemini API request failed: ${response.status}`)
      }

      const data = await response.json()

      const functionCall = extractFunctionCall(data)
      if (!functionCall) {
        return extractText(data) || 'Sorry, I could not process your request.'
      }

      const { name, args } = functionCall
      let result

      try {
        if (name === 'list_amenities') {
          if (!listAmenities) throw new Error('list_amenities tool not configured')
          const amenities = await listAmenities()
          const filtered = amenities.filter(a => {
            if (args.minCapacity && (a.capacity || 0) < args.minCapacity) return false
            if (args.type && a.type !== args.type) return false
            return a.isAvailable !== false
          })
          result = {
            amenities: filtered.map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              capacity: a.capacity,
              description: a.description
            })),
            count: filtered.length
          }
        } else if (name === 'check_availability') {
          if (!checkAvailability) throw new Error('check_availability tool not configured')
          result = await checkAvailability(args.amenityId, args.startTime, args.endTime)
        } else if (name === 'create_booking') {
          if (!createBooking || !checkAvailability) throw new Error('create_booking tool not configured')
          if (!memberId) {
            result = { success: false, error: 'Please log in to create a booking. You can sign in from the menu.' }
          } else {
            const availability = await checkAvailability(args.amenityId, args.startTime, args.endTime)
            if (!availability.available) {
              result = {
                success: false,
                error: availability.error || 'This slot was just booked by someone else. Please choose another time.'
              }
            } else {
              const bookingId = await createBooking({
                amenityId: args.amenityId,
                memberId,
                startTime: args.startTime,
                endTime: args.endTime
              })
              result = { success: true, bookingId }
            }
          }
        } else {
          result = { error: `Unknown function: ${name}` }
        }
      } catch (toolError) {
        console.error(`Tool ${name} error:`, toolError)
        result = { success: false, error: toolError.message || 'Tool execution failed' }
      }

      contents.push(
        {
          role: 'model',
          parts: [{ functionCall: { name, args } }]
        },
        {
          role: 'user',
          parts: [{
            functionResponse: {
              name,
              response: result
            }
          }]
        }
      )
      iteration++
    }

    return 'I reached my limit of tool calls. Please try again with a simpler request.'
  } catch (error) {
    console.error('Error in chatWithGeminiAgent:', error)
    return 'Sorry, I encountered an error. Please try again later.'
  }
}
