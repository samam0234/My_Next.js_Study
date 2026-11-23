"use client";
export async function api(url, method = "GET", body) {
    const response = await fetch(url, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204)
        return undefined;
    const value = await response.json();
    if (!response.ok)
        throw new Error(value.error?.message ?? `요청 실패 ${response.status}`);
    return value;
}
