import { Injectable } from "@nestjs/common";
import type { AuthenticatedContext } from "@erp/contracts";
import { ProviderManagementService } from "../providers/provider-management.service.js";
import type { GeocodeInput } from "./maps.schemas.js";

@Injectable()
export class MapsService {
  constructor(private readonly providers: ProviderManagementService) {}

  async geocode(input: GeocodeInput, auth: AuthenticatedContext, requestId: string): Promise<{
    readonly candidates: readonly unknown[];
    readonly privacyPrecisionApplied: GeocodeInput["precision"];
    readonly requiresHumanConfirmation: true;
  }> {
    const privacyPrecisionApplied = input.locationKind === "EMPLOYEE_HOME" && input.precision === "EXACT"
      ? "DISTRICT"
      : input.precision;
    const result = await this.providers.getActiveGeocodingProvider(auth).geocode({
      context: {
        tenantId: auth.tenantId,
        companyId: auth.companyId,
        actorUserId: auth.userId,
        requestId,
        correlationId: requestId,
        timeoutMs: 10_000
      },
      address: {
        countryCode: input.address.countryCode,
        ...(input.address.department === undefined ? {} : { department: input.address.department }),
        ...(input.address.province === undefined ? {} : { province: input.address.province }),
        ...(input.address.district === undefined ? {} : { district: input.address.district }),
        ...(input.address.street === undefined ? {} : { street: input.address.street }),
        ...(input.address.postalCode === undefined ? {} : { postalCode: input.address.postalCode }),
        ...(input.address.freeForm === undefined ? {} : { freeForm: input.address.freeForm })
      },
      precision: privacyPrecisionApplied
    });
    return {
      candidates: result.candidates,
      privacyPrecisionApplied,
      requiresHumanConfirmation: true
    };
  }
}
