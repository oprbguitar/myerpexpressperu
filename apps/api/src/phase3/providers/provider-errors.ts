import { DomainValidationError } from "@erp/domain";

export class ProviderUnavailableError extends DomainValidationError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderPolicyError extends DomainValidationError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ProviderPolicyError";
  }
}
