/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileCheck2,
  Plus,
  ShieldAlert,
  X
} from "lucide-react";
import { useAuth } from "../../../auth";
import { api, apiIdempotent } from "../../../api";
import { Button, EmptyState, Field, LoadingState, TextInput } from "../../../components/Ui";
import { dateLabel, ErrorNotice, FormActions } from "../../shared/OperationalUi";
import "../waste.css";

const lifecyclePhases = [
  ["GENERATION", "Generación"],
  ["CLASSIFICATION", "Clasificación"],
  ["SEGREGATION", "Segregación"],
  ["INITIAL_STORAGE", "Almacenamiento inicial"],
  ["INTERNAL_TRANSFER", "Traslado interno"],
  ["CENTRAL_STORAGE", "Almacén central"],
  ["DISPATCH", "Despacho"],
  ["FINAL_DESTINATION", "Destino final"],
  ["DOCUMENTARY_CLOSURE", "Cierre interno"]
] as const;

type WastePhase = (typeof lifecyclePhases)[number][0];
interface WasteRecord {
  id: string;
  source: string;
  description: string;
  quantity: string;
  unit: string;
  hazardous: boolean;
  currentPhase: WastePhase;
  status: string;
  generatedAt: string;
  createdAt: string;
  version: number;
  responsible: string | null;
  openExceptions: number;
  evidenceCount: number;
}
interface AttentionItem {
  id: string;
  recordId: string;
  severity: string;
  exceptionType: string;
  description: string;
  dueDate: string | null;
  status: string;
}
interface Overview {
  phases: Array<{ phase: WastePhase; records: number; quantity: string }>;
  requiresAttention: AttentionItem[];
}
interface WasteDetail {
  record: WasteRecord;
  events: Array<{
    id: string;
    fromPhase: WastePhase | null;
    toPhase: WastePhase;
    occurredAt: string;
    evidenceDocumentId: string | null;
    notes: string | null;
  }>;
  exceptions: Array<{
    id: string;
    severity: string;
    exceptionType: string;
    description: string;
    immediateAction: string | null;
    correctiveAction: string | null;
    dueDate: string | null;
    status: string;
    closureVerification: string | null;
    evidenceDocumentId: string | null;
    version: number;
  }>;
}

const phaseLabel = (phase: WastePhase) =>
  lifecyclePhases.find(([code]) => code === phase)?.[1] ?? phase;

const nextPhase = (phase: WastePhase): WastePhase | null => {
  const index = lifecyclePhases.findIndex(([code]) => code === phase);
  return lifecyclePhases[index + 1]?.[0] ?? null;
};

const severityLabel: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica"
};

const exceptionTypeLabel: Record<string, string> = {
  INCORRECT_SEGREGATION: "Segregación incorrecta",
  MIXED_WASTE: "Residuos mezclados",
  CONTAINER_OVERFLOW: "Contenedor desbordado",
  DAMAGED_CONTAINER: "Contenedor dañado",
  MISSING_LABEL: "Etiqueta faltante",
  MISSING_DESTINATION_EVIDENCE: "Evidencia de destino faltante",
  QUANTITY_DIFFERENCE: "Diferencia de cantidad",
  EXPIRED_AUTHORIZATION: "Autorización vencida",
  OVERDUE_CORRECTIVE_ACTION: "Acción correctiva vencida",
  MISSING_SUBMISSION_DOCUMENTATION: "Documentación de presentación faltante",
  BLOCKED_WORKFLOW: "Flujo bloqueado",
  OTHER: "Otra excepción"
};

const localDateTimeValue = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function LifecycleRail({
  active,
  available,
  onSelect
}: {
  active: WastePhase | null;
  available: ReadonlyMap<WastePhase, number>;
  onSelect: (phase: WastePhase | null) => void;
}) {
  return (
    <section className="waste-surface waste-lifecycle" aria-labelledby="waste-lifecycle-title">
      <div className="waste-section-heading">
        <div>
          <p>Ciclo de vida</p>
          <h2 id="waste-lifecycle-title">Fases operativas</h2>
        </div>
        {active ? <button className="waste-text-action" onClick={() => onSelect(null)}>Ver todas</button> : null}
      </div>
      <ol>
        {lifecyclePhases.map(([code, label], index) => {
          const selected = code === active;
          const count = available.get(code) ?? 0;
          return (
            <li key={code}>
              <button
                type="button"
                className={selected ? "is-selected" : ""}
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : code)}
              >
                <span className="waste-phase-index">{index + 1}</span>
                <span><strong>{label}</strong><small>{count === 0 ? "Sin registros" : `${count} ${count === 1 ? "registro" : "registros"}`}</small></span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function WasteWorkspacePage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const [phase, setPhase] = useState<WastePhase | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [exceptionFormOpen, setExceptionFormOpen] = useState(false);
  const [form, setForm] = useState({
    source: "",
    description: "",
    quantity: "",
    unit: "KG",
    hazardous: false,
    generatedAt: localDateTimeValue()
  });
  const [exceptionForm, setExceptionForm] = useState({
    severity: "MEDIUM",
    exceptionType: "OTHER",
    description: "",
    immediateAction: "",
    correctiveAction: "",
    dueDate: ""
  });
  const inspectorTitleRef = useRef<HTMLHeadingElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const canCreate = user?.permissions.includes("waste.create") ?? false;
  const canTransition = user?.permissions.includes("waste.transition") ?? false;
  const canManageExceptions = user?.permissions.includes("waste.exceptions.manage") ?? false;

  const overview = useQuery({
    queryKey: ["waste-overview"],
    queryFn: () => api<Overview>("/waste/overview")
  });
  const records = useQuery({
    queryKey: ["waste-records", phase],
    queryFn: () => api<WasteRecord[]>(`/waste/records?limit=100${phase ? `&phase=${phase}` : ""}`)
  });
  const detail = useQuery({
    queryKey: ["waste-record", selectedId],
    queryFn: () => api<WasteDetail>(`/waste/records/${selectedId}`),
    enabled: Boolean(selectedId)
  });

  const openRecord = (id: string) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const record = records.data?.find((item) => item.id === id);
    if (record) setPhase(record.currentPhase);
    setSelectedId(id);
  };

  const closeRecord = () => {
    setSelectedId(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };

  useEffect(() => {
    if (selectedId) inspectorTitleRef.current?.focus();
  }, [selectedId]);

  const refreshWaste = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["waste-overview"] }),
      client.invalidateQueries({ queryKey: ["waste-records"] }),
      client.invalidateQueries({ queryKey: ["waste-record"] })
    ]);
  };

  const createRecord = useMutation({
    mutationFn: () => apiIdempotent<{ id: string }>("/waste/records", "waste-record", {
      ...form,
      generatedAt: new Date(form.generatedAt).toISOString()
    }),
    onSuccess: async (result) => {
      setCreating(false);
      setForm({
        source: "",
        description: "",
        quantity: "",
        unit: "KG",
        hazardous: false,
        generatedAt: localDateTimeValue()
      });
      setPhase(null);
      setSelectedId(result.id);
      await refreshWaste();
    }
  });

  const advance = useMutation({
    mutationFn: (record: WasteRecord) => {
      const targetPhase = nextPhase(record.currentPhase);
      if (!targetPhase) throw new Error("El ciclo ya está completo.");
      return apiIdempotent(`/waste/records/${record.id}/advance`, "waste-advance", {
        targetPhase,
        version: record.version
      });
    },
    onSuccess: refreshWaste
  });

  const createException = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Seleccione un registro.");
      return apiIdempotent(`/waste/records/${selectedId}/exceptions`, "waste-exception", {
          severity: exceptionForm.severity,
          exceptionType: exceptionForm.exceptionType,
          description: exceptionForm.description,
          ...(exceptionForm.immediateAction ? { immediateAction: exceptionForm.immediateAction } : {}),
          ...(exceptionForm.correctiveAction ? { correctiveAction: exceptionForm.correctiveAction } : {}),
          ...(exceptionForm.dueDate ? { dueDate: exceptionForm.dueDate } : {})
      });
    },
    onSuccess: async () => {
      setExceptionFormOpen(false);
      setExceptionForm({
        severity: "MEDIUM",
        exceptionType: "OTHER",
        description: "",
        immediateAction: "",
        correctiveAction: "",
        dueDate: ""
      });
      await refreshWaste();
    }
  });

  const phaseCounts = useMemo(
    () => new Map(overview.data?.phases.map((row) => [row.phase, row.records]) ?? []),
    [overview.data]
  );

  if (overview.isLoading || records.isLoading) return <LoadingState label="Cargando gestión de residuos…" />;
  const pageError = overview.error ?? records.error;
  const selectedRecord = detail.data?.record ?? records.data?.find((record) => record.id === selectedId) ?? null;
  const targetPhase = selectedRecord ? nextPhase(selectedRecord.currentPhase) : null;

  return (
    <div className="waste-page">
      <header className="waste-page-header">
        <div>
          <p className="waste-context">Operación · Gestión de residuos</p>
          <h1>Cadena de custodia operativa</h1>
          <p>Registro y seguimiento operativo hasta el destino final. El cierre interno requiere un flujo de aprobación separado.</p>
        </div>
        {canCreate ? <Button onClick={() => setCreating(true)}><Plus aria-hidden="true" />Registrar generación</Button> : null}
      </header>

      <ErrorNotice error={pageError} />

      {creating ? (
        <section className="waste-surface waste-create" aria-labelledby="waste-create-title">
          <div className="waste-section-heading">
            <div><p>Captura guiada</p><h2 id="waste-create-title">Nuevo registro de generación</h2></div>
            <button className="waste-icon-action" type="button" onClick={() => setCreating(false)} aria-label="Cerrar formulario"><X /></button>
          </div>
          <ErrorNotice error={createRecord.error} />
          <form onSubmit={(event) => { event.preventDefault(); createRecord.mutate(); }}>
            <div className="waste-form-grid">
              <Field label="Origen o área generadora" required>
                <TextInput required maxLength={200} value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
              </Field>
              <Field label="Fecha y hora de generación" required>
                <TextInput required type="datetime-local" value={form.generatedAt} onChange={(event) => setForm({ ...form, generatedAt: event.target.value })} />
              </Field>
              <Field label="Descripción del material" required>
                <TextInput required maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
              <div className="waste-quantity-fields">
                <Field label="Cantidad" required>
                  <TextInput required type="number" inputMode="decimal" min="0.000001" step="0.000001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                </Field>
                <Field label="Unidad" required>
                  <select className="input" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
                    <option value="KG">kg</option>
                    <option value="T">t</option>
                    <option value="L">L</option>
                    <option value="M3">m³</option>
                    <option value="UNIDAD">unidad</option>
                  </select>
                </Field>
              </div>
              <label className="waste-check">
                <input type="checkbox" checked={form.hazardous} onChange={(event) => setForm({ ...form, hazardous: event.target.checked })} />
                <span><strong>Marcar para revisión de peligrosidad</strong><small>Esta marca no sustituye la clasificación técnica ni legal.</small></span>
              </label>
            </div>
            <FormActions pending={createRecord.isPending} submitLabel="Crear registro" onCancel={() => setCreating(false)} />
          </form>
        </section>
      ) : null}

      <div className="waste-workspace-grid">
        <div className="waste-primary-column">
          <section className="waste-surface waste-attention" aria-labelledby="waste-attention-title">
            <div className="waste-section-heading">
              <div><p>Cola operativa</p><h2 id="waste-attention-title">Requiere atención</h2></div>
            </div>
            {overview.error ? (
              <p className="waste-region-unavailable" role="status">No se pudo confirmar la cola de excepciones.</p>
            ) : (overview.data?.requiresAttention.length ?? 0) === 0 ? (
              <div className="waste-inline-empty"><CheckCircle2 aria-hidden="true" /><span><strong>Sin excepciones abiertas</strong><small>Las incidencias registradas aparecerán aquí con su severidad y plazo.</small></span></div>
            ) : (
              <ul className="waste-attention-list">
                {overview.data?.requiresAttention.map((item) => (
                  <li key={item.id}>
                    <ShieldAlert aria-hidden="true" />
                    <span><strong>{exceptionTypeLabel[item.exceptionType] ?? item.exceptionType}</strong><small>{item.description}</small></span>
                    <span className={`waste-severity severity-${item.severity.toLowerCase()}`}><AlertTriangle aria-hidden="true" />{severityLabel[item.severity] ?? item.severity}</span>
                    <span>{item.dueDate ? dateLabel(item.dueDate) : "Sin fecha límite"}</span>
                    <button onClick={() => openRecord(item.recordId)}>Atender</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <LifecycleRail active={phase} available={phaseCounts} onSelect={setPhase} />

          <section className="waste-surface waste-records" aria-labelledby="waste-records-title">
            <div className="waste-section-heading">
              <div><p>Libro operativo</p><h2 id="waste-records-title">Registros vinculados</h2></div>
              <div className="waste-list-context">
                {phase ? <span className="waste-active-filter">Fase: {phaseLabel(phase)}</span> : null}
                <small>Vista limitada a los 100 registros más recientes.</small>
              </div>
            </div>
            {records.error ? (
              <p className="waste-region-unavailable" role="status">No se pudo confirmar el libro de registros.</p>
            ) : (records.data?.length ?? 0) === 0 ? (
              <EmptyState
                title={phase ? "Sin registros en esta fase" : "Aún no hay registros de residuos"}
                description={phase ? "Seleccione otra fase o quite el filtro." : "Cree el primer registro de generación para iniciar la cadena de custodia."}
              />
            ) : (
              <>
                <div className="waste-table-wrap">
                  <table>
                    <caption>Registros de residuos con fase, cantidad, responsable y evidencia</caption>
                    <thead><tr>
                      <th scope="col">Registro</th>
                      <th scope="col">Origen</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Fase</th>
                      <th scope="col">Responsable</th>
                      <th scope="col">Evidencia</th>
                      <th scope="col"><span className="sr-only">Acción</span></th>
                    </tr></thead>
                    <tbody>
                      {records.data?.map((record) => (
                        <tr key={record.id} className={selectedId === record.id ? "is-selected" : ""}>
                          <td><strong>{record.description}</strong><small>{dateLabel(record.generatedAt)}{record.hazardous ? " · Marca preliminar: requiere evaluación" : ""}</small></td>
                          <td>{record.source}</td>
                          <td className="waste-number">{record.quantity} {record.unit}</td>
                          <td><span className="waste-phase-state"><Circle aria-hidden="true" />{phaseLabel(record.currentPhase)}</span></td>
                          <td>{record.responsible ?? "Sin asignar"}</td>
                          <td>{record.evidenceCount === 0 ? "Sin evidencia" : `${record.evidenceCount} vinculada${record.evidenceCount === 1 ? "" : "s"}`}</td>
                          <td><button onClick={() => openRecord(record.id)} aria-label={`Revisar ${record.description}`}>Revisar<ArrowRight aria-hidden="true" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="waste-mobile-records">
                  {records.data?.map((record) => (
                    <article key={record.id}>
                      <button onClick={() => openRecord(record.id)} aria-label={`Revisar ${record.description}`}>
                        <span><strong>{record.description}</strong><small>{record.source}</small></span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                      <dl>
                        <div><dt>Fase</dt><dd>{phaseLabel(record.currentPhase)}</dd></div>
                        <div><dt>Cantidad</dt><dd>{record.quantity} {record.unit}</dd></div>
                        <div><dt>Evidencia</dt><dd>{record.evidenceCount === 0 ? "Pendiente" : record.evidenceCount}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <aside className={`waste-inspector ${selectedId ? "has-selection" : ""}`} aria-labelledby="waste-inspector-title">
          <div className="waste-section-heading">
            <div><p>Inspector contextual</p><h2 ref={inspectorTitleRef} tabIndex={-1} id="waste-inspector-title">{selectedRecord ? "Detalle del registro" : "Seleccione un registro"}</h2></div>
            {selectedId ? <button className="waste-icon-action" onClick={closeRecord} aria-label="Cerrar detalle"><X /></button> : null}
          </div>
          {selectedId && detail.isLoading ? <LoadingState label="Cargando trazabilidad…" /> : null}
          <ErrorNotice error={detail.error ?? advance.error ?? createException.error} />
          {!selectedId ? (
            <div className="waste-inspector-empty"><ClipboardList aria-hidden="true" /><p>Revise un registro para consultar su fase, responsable, evidencias, excepciones e historial.</p></div>
          ) : selectedRecord ? (
            <>
              <section className="waste-inspector-summary">
                <span className="waste-phase-state"><Circle aria-hidden="true" />{phaseLabel(selectedRecord.currentPhase)}</span>
                <h3>{selectedRecord.description}</h3>
                <dl>
                  <div><dt>Origen</dt><dd>{selectedRecord.source}</dd></div>
                  <div><dt>Cantidad</dt><dd>{selectedRecord.quantity} {selectedRecord.unit}</dd></div>
                  <div><dt>Responsable</dt><dd>{selectedRecord.responsible ?? "Sin asignar"}</dd></div>
                  <div><dt>Estado</dt><dd>{selectedRecord.status === "CLOSED" ? "Cerrado" : "Activo"}</dd></div>
                </dl>
                {canTransition && targetPhase && targetPhase !== "DOCUMENTARY_CLOSURE" ? (
                  <Button disabled={advance.isPending} onClick={() => advance.mutate(selectedRecord)}>
                    {advance.isPending ? "Avanzando…" : `Avanzar a ${phaseLabel(targetPhase)}`}<ArrowRight aria-hidden="true" />
                  </Button>
                ) : null}
                {targetPhase === "DOCUMENTARY_CLOSURE" ? (
                  <div className="waste-blocked-note"><FileCheck2 aria-hidden="true" /><span><strong>Cierre interno no habilitado</strong><small>Esta entrega no acredita cumplimiento ambiental ni permite cerrar: falta el flujo separado de aprobación y evidencia vinculada al registro.</small></span></div>
                ) : null}
              </section>

              <section className="waste-timeline" aria-labelledby="waste-timeline-title">
                <h3 id="waste-timeline-title">Trazabilidad</h3>
                <ol>
                  {detail.data?.events.map((event) => (
                    <li key={event.id}>
                      <span aria-hidden="true" />
                      <div><strong>{phaseLabel(event.toPhase)}</strong><small>{dateLabel(event.occurredAt)}{event.notes ? ` · ${event.notes}` : ""}</small></div>
                      {event.evidenceDocumentId ? <FileCheck2 aria-label="Con evidencia vinculada" /> : null}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="waste-exceptions" aria-labelledby="waste-exceptions-title">
                <div className="waste-subsection-heading">
                  <h3 id="waste-exceptions-title">Excepciones</h3>
                  {canManageExceptions ? <button onClick={() => setExceptionFormOpen((value) => !value)}>{exceptionFormOpen ? "Cancelar" : "Registrar"}</button> : null}
                </div>
                {exceptionFormOpen ? (
                  <form onSubmit={(event) => { event.preventDefault(); createException.mutate(); }}>
                    <Field label="Severidad" required>
                      <select className="input" value={exceptionForm.severity} onChange={(event) => setExceptionForm({ ...exceptionForm, severity: event.target.value })}>
                        <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
                      </select>
                    </Field>
                    <Field label="Tipo" required>
                      <select className="input" value={exceptionForm.exceptionType} onChange={(event) => setExceptionForm({ ...exceptionForm, exceptionType: event.target.value })}>
                        {Object.entries(exceptionTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </Field>
                    <Field label="Descripción" required><TextInput required minLength={3} maxLength={1000} value={exceptionForm.description} onChange={(event) => setExceptionForm({ ...exceptionForm, description: event.target.value })} /></Field>
                    <Field label="Acción inmediata"><TextInput maxLength={1000} value={exceptionForm.immediateAction} onChange={(event) => setExceptionForm({ ...exceptionForm, immediateAction: event.target.value })} /></Field>
                    <Field label="Acción correctiva"><TextInput maxLength={1000} value={exceptionForm.correctiveAction} onChange={(event) => setExceptionForm({ ...exceptionForm, correctiveAction: event.target.value })} /></Field>
                    <Field label="Fecha límite"><TextInput type="date" value={exceptionForm.dueDate} onChange={(event) => setExceptionForm({ ...exceptionForm, dueDate: event.target.value })} /></Field>
                    <Button disabled={createException.isPending}>{createException.isPending ? "Registrando…" : "Registrar excepción"}</Button>
                  </form>
                ) : null}
                {(detail.data?.exceptions.length ?? 0) === 0 ? <p className="waste-muted">Sin excepciones registradas.</p> : (
                  <ul>
                    {detail.data?.exceptions.map((item) => (
                      <li key={item.id}>
                        <span className={`waste-severity severity-${item.severity.toLowerCase()}`}><AlertTriangle aria-hidden="true" />{severityLabel[item.severity] ?? item.severity}</span>
                        <strong>{exceptionTypeLabel[item.exceptionType] ?? item.exceptionType}</strong>
                        <small>{item.description}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
