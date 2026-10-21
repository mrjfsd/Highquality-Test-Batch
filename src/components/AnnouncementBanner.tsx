// Announcement banner — scrolls naturally with the page (not sticky/fixed).
// Intentional per product spec: banner scrolls away, navbar stays sticky.

interface AnnouncementBannerProps {
  message?: string;
}

export default function AnnouncementBanner({
  message = "COMPLIMENTARY DELIVERY ON ORDERS ABOVE ₹2,500",
}: AnnouncementBannerProps) {
  return (
    <div className="announcement">
      {message}
    </div>
  );
}
