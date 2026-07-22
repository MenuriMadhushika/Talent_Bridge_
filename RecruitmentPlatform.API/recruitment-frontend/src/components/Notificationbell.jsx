import { useEffect, useRef, useState } from "react";
import { notificationsApi } from "../api/notifications";

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const boxRef = useRef(null);

    async function loadUnreadCount() {
        try {
            const res = await notificationsApi.getUnreadCount();
            setUnreadCount(res?.count || 0);
        } catch {
            // Silently ignore — the bell just won't show a badge.
        }
    }

    useEffect(() => {
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handleClickOutside(e) {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function handleOpen() {
        const next = !open;
        setOpen(next);
        if (next) {
            try {
                setNotifications(await notificationsApi.getMine());
            } catch {
                setNotifications([]);
            }
        }
    }

    async function handleMarkAllRead() {
        try {
            await notificationsApi.markAllRead();
            setNotifications((prev) => prev?.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch {
            // best-effort
        }
    }

    async function handleMarkRead(id) {
        try {
            await notificationsApi.markRead(id);
            setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch {
            // best-effort
        }
    }

    return (
        <div className="notif-wrap" ref={boxRef}>
            <button className="notif-bell" onClick={handleOpen} aria-label="Notifications">
                🔔
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>

            {open && (
                <div className="notif-dropdown">
                    <div className="notif-header">
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                            <button className="notif-mark-all" onClick={handleMarkAllRead}>Mark all read</button>
                        )}
                    </div>
                    <div className="notif-list">
                        {notifications === null && <div className="notif-empty">Loading…</div>}
                        {notifications?.length === 0 && <div className="notif-empty">You're all caught up.</div>}
                        {notifications?.map((n) => (
                            <button
                                key={n.id}
                                className={`notif-item ${n.isRead ? "" : "unread"}`}
                                onClick={() => handleMarkRead(n.id)}
                            >
                                <div className="notif-title">{n.title}</div>
                                <div className="notif-message">{n.message}</div>
                                <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}