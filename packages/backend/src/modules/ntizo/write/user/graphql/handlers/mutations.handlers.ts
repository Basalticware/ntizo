import { graphqlRoutes } from "@cosmneo/onion-lasagna/graphql/server";
import { ForbiddenError } from "@cosmneo/onion-lasagna";
import { asNtizoGraphqlContext, type NtizoGraphqlContext } from "../../../../graphql/context";
import type { UpdateMyProfilePort } from "../../../../bounded-contexts/user/app/ports/inbound/update-my-profile.command.port";
import type {
  AddMyAddressPort,
  DeleteMyAddressPort,
  UpdateMyAddressPort,
} from "../../../../bounded-contexts/user/app/ports/inbound/address.command.port";
import type { StartPhoneVerificationPort } from "../../../../bounded-contexts/user/app/ports/inbound/start-phone-verification.command.port";
import type { SetPlatformRolePort } from "../../../../bounded-contexts/user/app/ports/inbound/set-platform-role.command.port";
import { userWriteSchema } from "../schema/mutations";
import { toExecutionContext } from "./arg-mappers";

export interface UserWriteModule {
  readonly updateMyProfile: UpdateMyProfilePort;
  readonly addMyAddress: AddMyAddressPort;
  readonly updateMyAddress: UpdateMyAddressPort;
  readonly deleteMyAddress: DeleteMyAddressPort;
  readonly startPhoneVerification: StartPhoneVerificationPort;
  readonly setPlatformRole: SetPlatformRolePort;
}

/**
 * Refuses anyone whose platform role is not `admin`.
 *
 * Both the id and the role: the context defaults an anonymous caller to
 * `customer`, so a role check alone would be reading a value chosen for the
 * absence of a user. Same shape and code as every other write module's.
 */
function requireAdmin(ctx: NtizoGraphqlContext): void {
  if (!ctx.requesterUserId || ctx.role !== "admin") {
    throw new ForbiddenError({
      message: "Only administrators may change a platform role",
      code: "ADMIN_ONLY",
    });
  }
}

export function createUserWriteHandlers(writeModule: UserWriteModule) {
  return graphqlRoutes(userWriteSchema)
    .handle("user.updateMe", async (args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      await writeModule.updateMyProfile.execute(toExecutionContext(nctx), args.input);
      return { ok: true as const };
    })
    // None of the three take an owner id. The command reads it off the
    // execution context, so there is no field a caller could set to reach
    // somebody else's address.
    .handle("user.addAddress", async (args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      return writeModule.addMyAddress.execute(toExecutionContext(nctx), args.input);
    })
    .handle("user.updateAddress", async (args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      await writeModule.updateMyAddress.execute(toExecutionContext(nctx), args.input);
      return { ok: true as const };
    })
    .handle("user.deleteAddress", async (args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      await writeModule.deleteMyAddress.execute(toExecutionContext(nctx), args.input);
      return { ok: true as const };
    })
    // No input: the subject and the number both come from the session.
    .handle("user.startPhoneVerification", async (_args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      const ticket = await writeModule.startPhoneVerification.execute(toExecutionContext(nctx));
      return {
        code: ticket.code,
        businessNumber: ticket.businessNumber,
        expiresAt: ticket.expiresAt.toISOString(),
      };
    })
    .handle("user.admin.setPlatformRole", async (args, ctx) => {
      const nctx = asNtizoGraphqlContext(ctx);
      requireAdmin(nctx);
      return writeModule.setPlatformRole.execute(toExecutionContext(nctx), {
        userId: args.input.userId,
        role: args.input.role,
      });
    })
    .build();
}
