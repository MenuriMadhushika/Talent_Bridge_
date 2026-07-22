const APPLICATION_STATUS_STYLE = {
  Submitted: "slate",
  UnderReview: "amber",
  Shortlisted: "teal",
  InterviewScheduled: "blue",
  Interviewed: "blue",
  Offered: "gold",
  Rejected: "rust",
  Withdrawn: "grey",
  Hired: "solid",
};

const POSTING_STATUS_STYLE = {
  Draft: "grey",
  Open: "teal",
  Closed: "slate",
  Archived: "grey",
};

export function ApplicationStatusBadge({ status }) {
  const tone = APPLICATION_STATUS_STYLE[status] || "slate";
  return <span className={`badge badge-${tone}`}>{splitWords(status)}</span>;
}

export function PostingStatusBadge({ status }) {
  const tone = POSTING_STATUS_STYLE[status] || "slate";
  return <span className={`badge badge-${tone}`}>{splitWords(status)}</span>;
}

function splitWords(value = "") {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
