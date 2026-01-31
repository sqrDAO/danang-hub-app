import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { useAuth } from '../contexts/AuthContext'
import { chatWithGeminiAgent } from '../services/gemini'
import { getAmenities } from '../services/amenities'
import { checkSlotAvailabilityCallable } from '../services/functions'
import { createBookingWithEventIfEventSpace } from '../services/bookings'
import { createEvent } from '../services/events'
import './Chatbot.css'

const normalizeMarkdown = (text) => {
  return text
    .replace(/\s+\*\s+\*\*/g, '\n* **') // Inline " * **bold**" -> list item on new line
    .replace(/([?.!):])\s+\*\s+/g, '$1\n* ') // "? * text" -> list item on new line
    .trim()
}

const Chatbot = () => {
  const { currentUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you with bookings or events today?'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      const createBookingForAgent = (args) =>
        createBookingWithEventIfEventSpace(args, {
          getAmenities,
          createEvent
        })

      const toolImplementations = {
        listAmenities: getAmenities,
        checkAvailability: checkSlotAvailabilityCallable,
        createBooking: createBookingForAgent
      }
      const response = await chatWithGeminiAgent(
        userMessage,
        conversationHistory,
        toolImplementations,
        currentUser?.uid
      )
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="chatbot-container">
          <div className="chatbot-header">
            <h3>AI Assistant</h3>
            <button className="chatbot-close" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>
          <div className="chatbot-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`chatbot-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                {message.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      ul: ({ children }) => <ul className="chatbot-list">{children}</ul>,
                      ol: ({ children }) => <ol className="chatbot-list">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      p: ({ children }) => <p className="chatbot-paragraph">{children}</p>
                    }}
                  >
                    {normalizeMarkdown(message.content)}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            ))}
            {isLoading && (
              <div className="chatbot-message assistant-message">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form className="chatbot-input-form" onSubmit={handleSend}>
            <input
              type="text"
              className="chatbot-input"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="btn btn-primary chatbot-send"
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}
      <button
        className="chatbot-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chatbot"
      >
        {isOpen ? '×' : '💬'}
      </button>
    </>
  )
}

export default Chatbot
