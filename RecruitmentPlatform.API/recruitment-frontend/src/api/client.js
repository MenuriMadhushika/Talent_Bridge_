const BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:56846/api";
// Custom error class used to store both the error message and HTTP status code.
class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
    const headers = { "Content-Type": "application/json" };

    if (auth) {
        const token = localStorage.getItem("tb_token");
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
        const message =
            payload?.error ||
            payload?.title ||
            (payload?.errors && Object.values(payload.errors).flat().join(" ")) ||
            `Request failed (${res.status})`;
        throw new ApiError(message, res.status);
    }

    return payload;
}

async function requestForm(path, formData) {
    const headers = {};
    const token = localStorage.getItem("tb_token");
    if (token) headers.Authorization = `Bearer ${token}`;
    // Deliberately no Content-Type — the browser sets the multipart boundary itself.

    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers,
        body: formData,
    });

    if (res.status === 204) return null;

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
        const message = payload?.error || payload?.title || `Upload failed (${res.status})`;
        throw new ApiError(message, res.status);
    }

    return payload;
}

export const api = {
    get: (path) => request(path),
    post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
    put: (path, body) => request(path, { method: "PUT", body }),
    del: (path) => request(path, { method: "DELETE" }),
    postForm: (path, formData) => requestForm(path, formData),
};

export { ApiError, BASE_URL };
