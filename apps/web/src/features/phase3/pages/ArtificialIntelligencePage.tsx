import { useState, type FormEvent } from "react";
import { apiIdempotent } from "../../../api";
import { Button } from "../../../components/Ui";
import { Phase3Header, ResourcePanel } from "../components/Phase3Ui";
import { usePhase3Resource } from "../usePhase3Resource";
import "../phase3.css";

interface AiAnswer {
  content?: string;
  warning?: string;
  citations?: Array<{ label?: string; sourceId?: string }>;
  interactionId?: string;
}

export default function ArtificialIntelligencePage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [status, setStatus] = useState("");
  const usage = usePhase3Resource<unknown>("/ai/usage");
  async function ask(event: FormEvent) {
    event.preventDefault();
    setStatus("Consultando herramientas autorizadas…");
    setAnswer(null);
    try {
      const result = await apiIdempotent<AiAnswer>("/ai/query", "ai-query", {
        prompt: question,
        documents: [],
        maximumOutputTokens: 500
      });
      setAnswer(result);
      setStatus("");
      usage.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo completar la consulta.");
    }
  }
  return (
    <div className="standard-page p3-page">
      <Phase3Header
        context="Asistencia controlada"
        title="Asistente de operación"
        description="Las respuestas pueden ser incompletas. Verifica las fuentes antes de decidir; la IA no ejecuta acciones consecuenciales."
      />
      <section className="p3-ai-layout">
        <form className="p3-ai-form" onSubmit={(event) => void ask(event)}>
          <label><span>Pregunta sobre información autorizada</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={5} maxLength={1200} required /></label>
          <Button type="submit" disabled={!question.trim()}>Consultar</Button>
          <small>No incluyas secretos, datos médicos ni documentos sin clasificar.</small>
        </form>
        <article className="p3-ai-answer" aria-live="polite">
          <h2>Respuesta</h2>
          {status ? <p>{status}</p> : null}
          {answer?.content ? <p>{answer.content}</p> : !status ? <p className="p3-muted">La respuesta aparecerá aquí con sus limitaciones y fuentes disponibles.</p> : null}
          {answer?.warning ? <div className="p3-ai-limits"><h3>Limitaciones</h3><p>{answer.warning}</p></div> : null}
          {answer?.citations?.length ? <div className="p3-citations"><h3>Fuentes</h3><ol>{answer.citations.map((citation, index) => <li key={`${citation.sourceId ?? "source"}-${index}`}>{citation.label ?? citation.sourceId ?? "Documento autorizado"}</li>)}</ol></div> : null}
          {answer?.content && !answer.citations?.length ? <p className="p3-warning">La respuesta no devolvió fuentes. No la uses como evidencia.</p> : null}
        </article>
      </section>
      <ResourcePanel title="Uso de IA" state={usage} empty="No hay consumo de IA registrado." reload={usage.reload} />
    </div>
  );
}
