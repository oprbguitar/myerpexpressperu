import { useEffect, useState, type FormEvent } from "react";
import { apiIdempotent } from "../../../api";
import { useAuth } from "../../../auth";
import { Button } from "../../../components/Ui";
import { deletePhase3Draft, getPhase3Draft, savePhase3Draft } from "../phase3Drafts";
import { Phase3Header, ResourcePanel, Tabs } from "../components/Phase3Ui";
import { usePhase3Resource } from "../usePhase3Resource";
import "../phase3.css";

interface InspectionDraft {
  branch: string;
  area: string;
  inspectionDate: string;
  finding: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  responsible: string;
  dueDate: string;
  evidenceName: string;
}

const initialDraft: InspectionDraft = {
  branch: "",
  area: "",
  inspectionDate: "",
  finding: "",
  severity: "MEDIUM",
  responsible: "",
  dueDate: "",
  evidenceName: ""
};

const tabs = [
  { id: "inspection", label: "Nueva inspección SST" },
  { id: "risks", label: "Riesgos" },
  { id: "actions", label: "Acciones correctivas" },
  { id: "incidents", label: "Incidentes y accidentes" }
];

export default function SstPage() {
  const { user } = useAuth();
  const [active, setActive] = useState("inspection");
  const [draft, setDraft] = useState<InspectionDraft>(initialDraft);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const risks = usePhase3Resource<unknown>("/sst/risks");
  const actions = usePhase3Resource<unknown>("/sst/corrective-actions");
  const incidents = usePhase3Resource<unknown>("/sst/incidents");
  useEffect(() => {
    if (!user) return;
    void getPhase3Draft<InspectionDraft>(user.userId, user.companyId, "sst-inspection")
      .then((record) => {
        if (record) {
          setDraft(record.value);
          setSaved(true);
        }
      });
  }, [user]);
  function update<K extends keyof InspectionDraft>(key: K, value: InspectionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  async function save() {
    if (!user) return;
    await savePhase3Draft({ userId: user.userId, companyId: user.companyId, kind: "sst-inspection", draftId: "new", value: draft });
    setSaved(true);
    setNotice("Borrador guardado");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    try {
      const inspection = await apiIdempotent<{ id: string }>("/sst/inspections", "sst-inspection", {
        inspectionType: draft.area.trim() || "Inspección SST",
        performedOn: draft.inspectionDate,
        status: "completed"
      });
      if (draft.finding) {
        const severity = draft.severity === "LOW" ? "low" : draft.severity === "HIGH" ? "high" : "medium";
        await apiIdempotent(`/sst/inspections/${inspection.id}/findings`, "sst-inspection-finding", {
          findingType: "nonconformity",
          description: draft.finding,
          severity
        });
      }
      if (user) await deletePhase3Draft(user.userId, user.companyId, "sst-inspection");
      setDraft(initialDraft);
      setSaved(false);
      setNotice("Inspección enviada para revisión.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo enviar la inspección.");
    }
  }
  return (
    <div className="standard-page p3-page p3-sst">
      <Phase3Header
        context="Seguridad y salud en el trabajo"
        title={active === "inspection" ? "Nueva inspección SST" : "Gestión SST"}
        description="Registra evidencia de campo con acceso controlado. No incluyas diagnósticos ni detalle médico."
      />
      <Tabs items={tabs} active={active} onChange={setActive} />
      {active === "inspection" ? (
        <form className="p3-sst-form" onSubmit={(event) => void submit(event)}>
          <div className="p3-draft-status" role="status"><strong>Paso 3 de 7</strong><span>{saved ? "Borrador guardado" : "Cambios sin guardar"}</span></div>
          <div className="p3-stepper" aria-label="Paso 3 de 7">{[1,2,3,4,5,6,7].map((step) => <span key={step} aria-current={step === 3 ? "step" : undefined}>{step}</span>)}</div>
          <div className="p3-form-grid">
            <label><span>Sede</span><input value={draft.branch} onChange={(e) => update("branch", e.target.value)} required /></label>
            <label><span>Área inspeccionada</span><input value={draft.area} onChange={(e) => update("area", e.target.value)} maxLength={100} required /></label>
            <label><span>Fecha de inspección</span><input type="date" value={draft.inspectionDate} onChange={(e) => update("inspectionDate", e.target.value)} required /></label>
            <label><span>Responsable de la inspección</span><input value={draft.responsible} onChange={(e) => update("responsible", e.target.value)} required /></label>
          </div>
          <fieldset className="p3-finding">
            <legend>Hallazgos</legend>
            <label><span>Descripción del hallazgo</span><textarea value={draft.finding} onChange={(e) => update("finding", e.target.value)} rows={4} required /></label>
            <div className="p3-form-grid p3-finding-fields">
              <label><span>Severidad</span><select value={draft.severity} onChange={(e) => update("severity", e.target.value as InspectionDraft["severity"])}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option></select></label>
              <label><span>Responsable de la acción</span><input value={draft.responsible} onChange={(e) => update("responsible", e.target.value)} required /></label>
              <label><span>Fecha límite</span><input type="date" value={draft.dueDate} onChange={(e) => update("dueDate", e.target.value)} required /></label>
            </div>
            <label className="p3-evidence"><span>Evidencia requerida para cerrar la acción correctiva</span><input type="file" accept="image/*" capture="environment" onChange={(e) => update("evidenceName", e.target.files?.[0]?.name ?? "")} /><strong>{draft.evidenceName || "Capturar evidencia"}</strong></label>
          </fieldset>
          {!navigator.onLine ? <div className="p3-offline-notice"><strong>Sincronización pendiente</strong><span>La inspección se enviará cuando recuperes conexión. Guarda el borrador antes de salir.</span></div> : null}
          {notice ? <p className="p3-inline-notice" role="status">{notice}</p> : null}
          <div className="p3-bottom-actions"><Button type="button" variant="secondary" onClick={() => void save()}>Guardar borrador</Button><Button type="submit">Enviar inspección</Button></div>
        </form>
      ) : active === "risks" ? <ResourcePanel title="Riesgos SST" state={risks} empty="No hay riesgos visibles." reload={risks.reload} />
        : active === "actions" ? <ResourcePanel title="Acciones correctivas" state={actions} empty="No hay acciones correctivas pendientes." reload={actions.reload} />
          : <ResourcePanel title="Incidentes y accidentes" state={incidents} empty="No hay incidentes visibles." reload={incidents.reload} />}
    </div>
  );
}
