import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";

const ACTION_COLOR = {
  LOGIN_SUCCESS: "badge-green",
  LOGIN_FAILURE: "badge-red",
  REGISTER_CAMPER: "badge-green",
  UPDATE_CAMPER: "badge-gold",
  DELETE_CAMPER: "badge-red",
  CHECK_IN: "badge-green",
  CHECK_OUT: "badge-gray",
  CREATE_SCHEDULE_EVENT: "badge-green",
  UPDATE_SCHEDULE_EVENT: "badge-gold",
  DELETE_SCHEDULE_EVENT: "badge-red",
  CREATE_USER: "badge-green",
  UPDATE_USER: "badge-gold",
  DELETE_USER: "badge-red"
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(() => {
    setLoading(true);
    api.get(`/api/users/audit-logs?page=${page}&per_page=25`)
      .then(res => {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
      })
      .catch(err => {
        setError("Failed to fetch application activity logs.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatTimestamp = (isoString) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (e) {
      return isoString;
    }
  };

  return (
    <>
      <div className="top-bar">
        <h1>📄 System Activity Logs</h1>
        <span className="text-muted">Review security events and administrative actions</span>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--forest-mid)" }}>Activity Log Feed</span>
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>Total events: {total}</span>
          </div>

          <div className="table-wrap" style={{ margin: 0, border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 180 }}>Timestamp</th>
                  <th style={{ width: 140 }}>Operator</th>
                  <th style={{ width: 220 }}>Action</th>
                  <th>Details</th>
                  <th style={{ width: 130 }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center" style={{ padding: 32 }}>
                      Loading system logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center" style={{ padding: 32, color: "var(--muted)" }}>
                      No activity logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: "0.82rem", color: "var(--charcoal)", fontWeight: 500 }}>
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--forest-mid)" }}>
                          {log.username || "System"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${ACTION_COLOR[log.action] || "badge-gray"}`} style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.85rem", color: "var(--charcoal)", lineHeight: 1.4 }}>
                        {log.details || "—"}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)", fontFamily: "monospace" }}>
                        {log.ip_address || "N/A"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pages > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
            <button 
              className="btn btn-ghost btn-sm" 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            <span className="text-muted" style={{ lineHeight: "32px", fontSize: "0.85rem" }}>
              Page {page} of {pages}
            </span>
            <button 
              className="btn btn-ghost btn-sm" 
              disabled={page === pages} 
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
