SELECT (SELECT COUNT(*)::int FROM "Session") AS session_count, (SELECT COUNT(*)::int FROM stores) AS store_count;
