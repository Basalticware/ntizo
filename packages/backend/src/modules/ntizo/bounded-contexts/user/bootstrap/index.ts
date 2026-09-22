// User BC bootstrap — wires adapters into use cases.

import { DrizzleUserRepository } from "../infrastructure/repositories/drizzle-user.repository";
import { DrizzleProfileRepository } from "../infrastructure/repositories/drizzle-profile.repository";
import { UpgradeProfileToProviderInternalCommand } from "../app/use-cases/upgrade-profile-to-provider.internal.command";
import { RevertProviderUpgradeInternalCommand } from "../app/use-cases/revert-provider-upgrade.internal.command";
import { CreateUserOnSignUpInternalCommand } from "../app/use-cases/create-user-on-sign-up.internal.command";
import { UpdateMyProfileCommand } from "../app/use-cases/update-my-profile.command";
import {
  AddMyAddressCommand,
  DeleteMyAddressCommand,
  UpdateMyAddressCommand,
} from "../app/use-cases/manage-my-addresses.command";
import { DrizzleAddressRepository } from "../infrastructure/repositories/drizzle-address.repository";
import { BetterAuthIdentityAdapter } from "../infrastructure/adapters/better-auth-identity.adapter";
import { DrizzleUnitOfWork } from "../../../../../shared/infrastructure/unit-of-work";
import { OutboxAdapter } from "../../../../../shared/infrastructure/outbox/outbox.adapter";
import { DrizzleOutboxEventRepository } from "../../../../../shared/infrastructure/outbox/drizzle/outbox-event.repository";
import { StartPhoneVerificationCommand } from "../app/use-cases/start-phone-verification.command";
import { ConfirmPhoneFromWhatsAppInternalCommand } from "../app/use-cases/confirm-phone-from-whatsapp.internal.command";
import { BetterAuthPhoneVerificationCodeStore } from "../infrastructure/adapters/better-auth-phone-verification-code.store";
import { EnvPhoneVerificationChannel } from "../infrastructure/adapters/env-phone-verification-channel.adapter";
import { WhatsAppPhoneVerificationReplies } from "../infrastructure/adapters/whatsapp-phone-verification-replies.adapter";
import { LazyWhatsAppMessenger } from "../../../../../shared/infrastructure/whatsapp";
import { SetPlatformRoleCommand } from "../app/use-cases/set-platform-role.command";

export function bootstrapUser() {
  const userRepository = new DrizzleUserRepository();
  const profileRepository = new DrizzleProfileRepository();
  const unitOfWork = new DrizzleUnitOfWork();
  const outboxPort = new OutboxAdapter(new DrizzleOutboxEventRepository());

  const upgradeProfileToProvider = new UpgradeProfileToProviderInternalCommand(
    userRepository,
  );
  const revertProviderUpgrade = new RevertProviderUpgradeInternalCommand(
    userRepository,
  );
  const createUserOnSignUp = new CreateUserOnSignUpInternalCommand(
    userRepository,
    profileRepository,
    unitOfWork,
    outboxPort,
  );

  const authIdentity = new BetterAuthIdentityAdapter();
  const setPlatformRole = new SetPlatformRoleCommand(
    userRepository,
    userRepository,
    authIdentity,
    unitOfWork,
    outboxPort,
  );
  const updateMyProfile = new UpdateMyProfileCommand(
    profileRepository,
    unitOfWork,
    authIdentity,
  );

  const addressRepository = new DrizzleAddressRepository();
  const addMyAddress = new AddMyAddressCommand(addressRepository, unitOfWork);
  const updateMyAddress = new UpdateMyAddressCommand(addressRepository, unitOfWork);
  const deleteMyAddress = new DeleteMyAddressCommand(addressRepository, unitOfWork);

  const phoneVerificationCodes = new BetterAuthPhoneVerificationCodeStore();
  const startPhoneVerification = new StartPhoneVerificationCommand(
    authIdentity,
    phoneVerificationCodes,
    new EnvPhoneVerificationChannel(),
  );
  const confirmPhoneFromWhatsApp = new ConfirmPhoneFromWhatsAppInternalCommand(
    authIdentity,
    phoneVerificationCodes,
    profileRepository,
    new WhatsAppPhoneVerificationReplies(new LazyWhatsAppMessenger()),
  );

  return {
    adapters: {
      userRepository,
      profileRepository,
      addressRepository,
      unitOfWork,
      outboxPort,
      authIdentity,
    },
    useCases: {
      updateMyProfile,
      addMyAddress,
      updateMyAddress,
      deleteMyAddress,
      startPhoneVerification,
      setPlatformRole,
      internal: {
        upgradeProfileToProvider,
        revertProviderUpgrade,
        createUserOnSignUp,
        confirmPhoneFromWhatsApp,
      },
    },
  };
}

export type UserBootstrap = ReturnType<typeof bootstrapUser>;
