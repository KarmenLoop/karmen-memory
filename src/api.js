let csrf;
export async function connect() {
  const response = await fetch("/api/session");
  const value = await response.json();
  if (!response.ok) throw Error(value.error || "无法连接本地服务");
  csrf = value.csrf;
}
export async function api(
  path,
  input,
  method = input === undefined ? "GET" : "POST",
) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(input !== undefined
        ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
        : {}),
    },
    ...(input !== undefined ? { body: JSON.stringify(input) } : {}),
  });
  if (!response.ok) {
    let value;
    try {
      value = await response.json();
    } catch {}
    throw Error(value?.error || `服务请求失败 (${response.status})`);
  }
  return response.json();
}
export async function download(path, input, name) {
  const response = await fetch(`/api${path}`, {
    method: input ? "POST" : "GET",
    headers: input
      ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
      : {},
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  if (!response.ok) {
    const value = await response.json();
    throw Error(value.error);
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
