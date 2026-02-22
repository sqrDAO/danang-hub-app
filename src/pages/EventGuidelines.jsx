import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import './EventGuidelines.css'

const EventGuidelines = () => {
  return (
    <Layout public>
      <div className="event-guidelines-page">
        <div className="event-guidelines-hero">
          <div className="container">
            <h1 className="event-guidelines-title">Event Guidelines</h1>
            <p className="event-guidelines-subtitle">
              Da Nang Blockchain Hub — guidelines for hosting and running events at the Hub
            </p>
          </div>
        </div>

        <div className="event-guidelines-content container">
          <article className="event-guidelines-article glass">
            <section className="guidelines-section">
              <h2>Before the Event</h2>
              <ul>
                <li>
                  <strong>Book in advance:</strong> Submit your event proposal at least 2 weeks prior to your desired date through our booking system (including technical requirements and capacity).
                </li>
                <li>
                  <strong>Event approval:</strong> All events must be approved by the Hub management team. We prioritize blockchain, Web3, and technology-focused events.
                </li>
                <li>
                  <strong>Promotion:</strong> Coordinate with our marketing team to promote your event through Hub channels if desired.
                </li>
                <li>
                  <strong>Deposit (support & cleaning):</strong> A refundable deposit of <strong>USD $50–$100</strong> may be required (amount depends on event scale and scope) to cover support staff and cleaning, if necessary. Any deductions will be documented and communicated after the event.
                </li>
                <li>
                  <strong>Branding & acknowledgements:</strong>
                  <ul>
                    <li><strong>Hub logo placement:</strong> Include the Da Nang Blockchain Hub logo on <em>all</em> event materials (online and offline) with the Hub credited as <strong>Community Partner</strong>, <strong>Venue Sponsor</strong>, or an equivalent title agreed with the Hub.</li>
                    <li><strong>Partner recognition:</strong> If there is a “Partners / Sponsors” section, list the Hub there as well (consistent naming, logo sizing, and placement).</li>
                    <li><strong>Stage acknowledgement:</strong> Allocate 2–3 minutes for a Hub representative and/or <strong>NAPA (building owner)</strong> representative to say a few words (welcome, safety, housekeeping, community note).</li>
                    <li><strong>Signage:</strong> If using onsite signage (standees, banners, check-in backdrop), include the Hub logo.</li>
                    <li><strong>Social posts:</strong> Tag the Hub’s official channels (when provided) and include at least 1 pre-event post and 1 post-event recap crediting the Hub.</li>
                    <li><strong>Media capture:</strong> If photos/videos are captured, provide the Hub with a small asset pack (10–20 photos and any highlight clips) within 7 days, and allow the Hub to repost with credit.</li>
                    <li><strong>No implied endorsement:</strong> Use Hub/NAPA names and logos only for agreed event promotion. Do not imply endorsement of third-party products or financial offerings.</li>
                  </ul>
                </li>
              </ul>
            </section>

            <section className="guidelines-section">
              <h2>During the Event</h2>
              <ul>
                <li><strong>Setup time:</strong> Arrive at least 30 minutes before the event start time for setup and technical checks.</li>
                <li><strong>Respect the space:</strong> Keep noise levels reasonable and be mindful of other Hub members and activities.</li>
                <li><strong>Follow safety protocols:</strong> Adhere to all safety guidelines, including emergency exits and maximum capacity rules.</li>
                <li><strong>Recording policy:</strong> Inform attendees if the event will be recorded or photographed.</li>
                <li><strong>Refreshments:</strong> Coordinate with Hub staff for any catering needs. Outside food and beverages must be pre-approved.</li>
              </ul>
            </section>

            <section className="guidelines-section">
              <h2>After the Event</h2>
              <ul>
                <li><strong>Clean up:</strong> Return the space to its original condition within 3 hours of event conclusion.</li>
                <li><strong>Equipment return:</strong> Ensure all borrowed equipment is returned in good condition.</li>
                <li><strong>Damage reporting:</strong> Report any damages or issues to Hub management immediately.</li>
              </ul>
            </section>

            <section className="guidelines-section">
              <h2>Code of Conduct</h2>
              <ul>
                <li><strong>Inclusive environment:</strong> Maintain a welcoming atmosphere for all participants regardless of background, identity, or experience level.</li>
                <li><strong>Professional behavior:</strong> Conduct yourself professionally and respectfully at all times.</li>
                <li><strong>No solicitation:</strong> Direct sales and aggressive marketing are not permitted without prior approval.</li>
                <li><strong>Compliance:</strong> Follow all Vietnamese laws and regulations, particularly regarding blockchain and cryptocurrency discussions.</li>
              </ul>
            </section>

            <section className="guidelines-section">
              <h2>Cancellation Policy</h2>
              <ul>
                <li><strong>72-hour notice:</strong> Events must be cancelled at least 72 hours in advance to avoid penalties.</li>
                <li><strong>Emergency cancellations:</strong> Contact Hub management immediately if unforeseen circumstances require last-minute cancellation.</li>
              </ul>
            </section>

            <section className="guidelines-cta">
              <p>
                For questions or to book your event, contact us at{' '}
                <a href="mailto:gm@sqrdao.com" className="guidelines-email">
                  gm@sqrdao.com
                </a>
              </p>
              <Link to="/member/events?action=create" className="btn btn-primary">
                Create an event
              </Link>
            </section>
          </article>
        </div>
      </div>
    </Layout>
  )
}

export default EventGuidelines
