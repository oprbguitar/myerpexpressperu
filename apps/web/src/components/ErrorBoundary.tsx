/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Al cambiar, el límite se reinicia (p. ej. la ruta actual). */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

/**
 * Límite de error de React. Sin él, un fallo de render en cualquier página
 * deja la aplicación en blanco por completo. Con él, el fallo queda contenido
 * en el área de contenido y el resto de la interfaz sigue usable.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidUpdate(previous: Props): void {
    // Al navegar a otra ruta, se limpia el error para reintentar el render.
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Solo consola del navegador; no se envía a ningún servicio externo.
    console.error("Error de render contenido por ErrorBoundary:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <section className="standard-page" role="alert">
          <h1>No se pudo mostrar esta sección</h1>
          <p>
            Ocurrió un error al representar esta pantalla. El resto de la aplicación
            sigue disponible; use la navegación para continuar.
          </p>
          <button className="button secondary" onClick={() => this.setState({ error: null })}>
            Reintentar
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
