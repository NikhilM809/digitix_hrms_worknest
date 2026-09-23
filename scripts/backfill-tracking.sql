UPDATE "TimeEntry"
SET "originalHours" = hours
WHERE "originalHours" = 0;

UPDATE "Project"
SET "trackingStatus" = CASE status::text
  WHEN 'BID' THEN 'NOT_STARTED'::"TrackingStatus"
  WHEN 'NEED_TO_START' THEN 'NOT_STARTED'::"TrackingStatus"
  WHEN 'SCRIPT_WIP' THEN 'IN_PROGRESS'::"TrackingStatus"
  WHEN 'CHANGES' THEN 'IN_PROGRESS'::"TrackingStatus"
  WHEN 'LIVE' THEN 'IN_PROGRESS'::"TrackingStatus"
  WHEN 'HOLD' THEN 'ON_HOLD'::"TrackingStatus"
  WHEN 'CLOSE' THEN 'COMPLETED'::"TrackingStatus"
  WHEN 'CANCEL' THEN 'COMPLETED'::"TrackingStatus"
  ELSE 'NOT_STARTED'::"TrackingStatus"
END
WHERE "trackingStatus" = 'NOT_STARTED';
