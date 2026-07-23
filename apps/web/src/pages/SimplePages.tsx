import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Button, EmptyState, LoadingState, PageHeader } from "../components/Ui";

export function HomePage() {
  return <div className="standard-page"><PageHeader eyebrow="ERP Express Perú" title="Inicio" /><EmptyState title="Núcleo listo" description="Configure su organización, usuarios, permisos y módulos desde la navegación principal." /></div>;
}
export function BranchesPage() {
  const branches = useQuery({ queryKey: ["branches"], queryFn: () => api<Array<{ id: string; name: string; code: string; address?: string; status: string }>>("/branches") });
  if (branches.isLoading) return <LoadingState />;
  return <div className="standard-page"><PageHeader eyebrow="Organización" title="Sedes y establecimientos" /><div className="data-list">{branches.data?.map((branch) => <article key={branch.id}><div><h2>{branch.name}</h2><p>{branch.address}</p><code>{branch.code}</code></div><span className="status status-success">{branch.status === "active" ? "Activa" : branch.status}</span></article>)}</div></div>;
}
export function UsersPage() {
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<Array<{ id: string; fullName: string; email: string; status: string; lastLoginAt?: string }>>("/users") });
  if (users.isLoading) return <LoadingState />;
  return <div className="standard-page"><PageHeader eyebrow="Identidad" title="Usuarios" />
    <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Estado</th><th>Último acceso</th></tr></thead>
      <tbody>{users.data?.map((user) => <tr key={user.id}><td>{user.fullName}</td><td>{user.email}</td><td><span className={`status ${user.status === "active" ? "status-success" : ""}`}>{user.status === "active" ? "Activo" : user.status}</span></td><td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("es-PE") : "Sin acceso"}</td></tr>)}</tbody>
    </table></div>
    <div className="mobile-data-list">{users.data?.map((user) => <article key={user.id}><strong>{user.fullName}</strong><span>{user.email}</span><small>{user.status === "active" ? "Activo" : user.status}</small></article>)}</div>
  </div>;
}
export function RolesPage() {
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<Array<{ id: string; name: string; code: string; isSystem: boolean; permissions: string[] }>>("/roles") });
  if (roles.isLoading) return <LoadingState />;
  return <div className="standard-page"><PageHeader eyebrow="Autorización" title="Roles y permisos" />
    <div className="data-list">{roles.data?.map((role) => <article key={role.id}><div><h2>{role.name}</h2><p>{role.permissions.length} permisos efectivos</p><code>{role.code}</code></div><span className="status">{role.isSystem ? "Sistema" : "Personalizado"}</span></article>)}</div>
  </div>;
}
export function DocumentsPage() {
  const documents = useQuery({ queryKey: ["documents"], queryFn: () => api<Array<{ id: string; filename: string; mimeType: string; sizeBytes: string; uploadedAt: string }>>("/documents") });
  const [message, setMessage] = useState("");
  if (documents.isLoading) return <LoadingState />;
  return <div className="standard-page"><PageHeader eyebrow="Documentos" title="Archivos privados" action={
    <label className="button button-secondary">Subir documento<input type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={(event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) { setMessage("El archivo supera 25 MB."); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") { setMessage("No se pudo leer el archivo."); return; }
        const base64 = result.split(",")[1];
        void api("/documents", { method: "POST", body: JSON.stringify({ filename: file.name, mimeType: file.type, base64, ownerEntityType: "company" }) })
          .then(() => { setMessage("Documento cargado."); void documents.refetch(); })
          .catch(() => setMessage("No se pudo cargar el documento."));
      };
      reader.readAsDataURL(file);
    }} /></label>
  } />
    {message ? <div className="notice">{message}</div> : null}
    {documents.data?.length ? <div className="data-list">{documents.data.map((document) => <article key={document.id}><div><h2>{document.filename}</h2><p>{document.mimeType} · {Math.ceil(Number(document.sizeBytes) / 1024)} KB</p></div><Button variant="secondary" onClick={() => void api<{ url: string }>(`/documents/${document.id}/download`).then(({ url }) => window.open(url, "_blank", "noopener"))}>Descargar</Button></article>)}</div>
      : <EmptyState title="Sin documentos" description="Los documentos autorizados aparecerán aquí. La carga valida tipo, tamaño, hash y pertenencia empresarial." />}
  </div>;
}
