import { graphqlRoutes } from "@cosmneo/onion-lasagna/graphql/server";
import { asNtizoGraphqlContext } from "../../../../graphql/context";
import type {
  GetCurrentUserProjectionPort,
  ListMyAddressesPort,
} from "../../app/ports/inbound";
import { ForbiddenError } from "@cosmneo/onion-lasagna";
import type { ListUsersForAdminProjection } from "../../app/use-cases/list-users-for-admin.projection";
import type { GetUserDetailForAdminProjection } from "../../app/use-cases/get-user-detail-for-admin.projection";
import type { NtizoGraphqlContext } from "../../../../graphql/context";
import { userReadSchema } from "../schema/queries";
import { mapGetCurrentUserInput, mapListMyAddressesInput } from "./arg-mappers";

export interface UserReadModule {
  readonly getCurrentUser: GetCurrentUserProjectionPort;
  readonly listMyAddresses: ListMyAddressesPort;
  readonly listUsersForAdmin: ListUsersForAdminProjection;
  readonly getUserDetailForAdmin: GetUserDetailForAdminProjection;
}

/** The page size when the caller does not ask for one. See the projection. */
const DEFAULT_ADMIN_USER_PAGE = 25;

/**
 * Both the id and the role: the context defaults an anonymous caller to
 * `customer` rather than to null, so a role check alone would be reading a
 * value chosen for the absence of a user.
 */
function requireAdminRequester(ctx: NtizoGraphqlContext, message: string): string {
  const { requesterUserId, role } = ctx;
  if (!requesterUserId || role !== "admin") {
    throw new ForbiddenError({ message, code: "ADMIN_ONLY" });
  }
  return requesterUserId;
}

export function createUserReadHandlers(readModule: UserReadModule) {
  return graphqlRoutes(userReadSchema)
    .handleWithUseCase("user.me", {
      argsMapper: (_args, ctx) => mapGetCurrentUserInput(asNtizoGraphqlContext(ctx)),
      useCase: readModule.getCurrentUser,
      responseMapper: (output) => output,
    })
    .handleWithUseCase("user.myAddresses", {
      // Same rule as above: the owner comes from the session, and the args
      // carry nothing this handler reads.
      argsMapper: (_args, ctx) => mapListMyAddressesInput(asNtizoGraphqlContext(ctx)),
      useCase: readModule.listMyAddresses,
      responseMapper: (output) => output,
    })
    .handleWithUseCase("user.allForAdmin", {
      argsMapper: (args, ctx) => {
        // Checked in the mapper, the one place that sees both the requester
        // and the input.
        requireAdminRequester(asNtizoGraphqlContext(ctx), "Only administrators may list every user");
        return {
          role: args.input.role,
          search: args.input.search,
          limit: args.input.limit ?? DEFAULT_ADMIN_USER_PAGE,
          offset: args.input.offset ?? 0,
        };
      },
      useCase: readModule.listUsersForAdmin,
      responseMapper: (output) => output,
    })
    .handleWithUseCase("user.detailForAdmin", {
      argsMapper: (args, ctx) => ({
        requesterUserId: requireAdminRequester(
          asNtizoGraphqlContext(ctx),
          "Only administrators may read a user's file",
        ),
        userId: args.input.userId,
      }),
      useCase: readModule.getUserDetailForAdmin,
      responseMapper: (output) => output,
    })
    .build();
}
