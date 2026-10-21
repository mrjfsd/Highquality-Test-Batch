// Announcement banner — scrolls naturally with the page (not sticky/fixed).
// Consistent with burgundy brand palette and easy to update when a promotion changes.

interface AnnouncementBannerProps {
  message?: string;
}

export default function AnnouncementBanner({
  message = "A LITTLE MORE STYLE, A LITTLE LESS SPEND — EXPLORE OUR LATEST EDITS.",
}: AnnouncementBannerProps) {
  return (
    <div className="announcement" id="top">
      {message}
    </div>
  );
}
