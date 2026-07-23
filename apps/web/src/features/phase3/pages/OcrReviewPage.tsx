import { useState, type FormEvent } from "react";
import { apiIdempotent, createIdempotencyKey } from "../../../api";
import { Button } from "../../../components/Ui";
import { Phase3Header } from "../components/Phase3Ui";
import "../phase3.css";

interface ExtractionField { name: string; value: string; confidence: number }
interface OcrJob {
  id: string;
  state: string;
  warning: string;
  extraction: {
    fields: ExtractionField[];
    overallConfidence: number;
    mock: boolean;
    requiresHumanReview: true;
  };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export default function OcrReviewPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<OcrJob | null>(null);
  const [review, setReview] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      setStatus("Tipo de archivo no permitido. Usa PDF, JPEG o PNG.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus("El archivo excede el límite OCR de 10 MiB.");
      return;
    }
    setStatus("Procesando archivo…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base64 = encodeBase64(bytes);
      const digest = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
      const document = await apiIdempotent<{ id: string; sha256: string }>("/documents", "ocr-source-document", {
        filename: file.name,
        mimeType: file.type,
        base64,
        ownerEntityType: "supplier-receipt"
      });
      const result = await apiIdempotent<OcrJob>("/ocr/jobs", "ocr-job", {
        documentId: document.id,
        requestedDocumentType: "SUPPLIER_RECEIPT",
        fileName: file.name,
        contentType: file.type,
        contentBase64: base64,
        contentSha256: document.sha256 || digest,
        dataCategories: ["FINANCIAL"],
        identityDocumentAuthorized: false,
        idempotencyKey: createIdempotencyKey("ocr-job")
      });
      setJob(result);
      setReview(Object.fromEntries(result.extraction.fields.map((field) => [field.name, field.value])));
      setStatus("Extracción recibida. Revisa los campos antes de confirmar.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo procesar el archivo.");
    }
  }
  async function confirm() {
    if (!job) return;
    try {
      const corrections = job.extraction.fields.flatMap((field) => {
        const correctedValue = review[field.name] ?? field.value;
        return correctedValue === field.value ? [] : [{
          fieldName: field.name,
          previousValue: field.value,
          correctedValue,
          reason: "Corrección durante revisión humana"
        }];
      });
      await apiIdempotent(`/ocr/extractions/${job.id}/confirm`, "ocr-confirm", {
        corrections,
        outcome: "DRAFT_APPROVED"
      });
      setStatus("Revisión confirmada. El resultado continúa como borrador financiero.");
      setJob(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo confirmar la revisión.");
    }
  }
  return (
    <div className="standard-page p3-page">
      <Phase3Header
        context="Automatización asistida"
        title="Revisión OCR"
        description="OCR propone datos; una persona debe validarlos. Nunca crea un registro financiero final de forma silenciosa."
      />
      <section className="p3-review-layout">
        <form className="p3-upload-panel" onSubmit={(event) => void upload(event)}>
          <h2>Capturar documento</h2>
          <p>Adjunta una imagen o PDF permitido. Evita documentos con información no necesaria para el gasto.</p>
          <label className="p3-file-drop"><input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /><strong>{file?.name ?? "Seleccionar archivo"}</strong><span>La API valida tipo y tamaño.</span></label>
          <Button type="submit" disabled={!file}>Procesar con OCR</Button>
          {status ? <p className="p3-inline-notice" role="status">{status}</p> : null}
          {job ? <Button type="button" variant="secondary" onClick={() => void confirm()}>Confirmar revisión humana</Button> : null}
        </form>
        <aside className="p3-limits">
          <h2>Antes de confirmar</h2>
          <ul><li>Compara importe, moneda, fecha y proveedor con el original.</li><li>Revisa posibles duplicados.</li><li>Los campos de baja confianza requieren corrección manual.</li></ul>
        </aside>
      </section>
      {job ? <section className="p3-panel p3-extraction">
        <div className="p3-panel-title"><h2>Campos extraídos por revisar</h2><span>Confianza general {Math.round(job.extraction.overallConfidence * 100)}%</span></div>
        <div className="p3-extraction-fields">{job.extraction.fields.map((field) => (
          <label key={field.name}>
            <span>{field.name} · {Math.round(field.confidence * 100)}%</span>
            <input value={review[field.name] ?? ""} onChange={(event) => setReview((current) => ({ ...current, [field.name]: event.target.value }))} />
          </label>
        ))}</div>
        <p className="p3-warning">{job.warning}{job.extraction.mock ? " Resultado identificado como demostración mock." : ""}</p>
      </section> : null}
    </div>
  );
}
