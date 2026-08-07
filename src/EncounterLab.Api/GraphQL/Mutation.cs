using HotChocolate;
using EncounterLab.Api.Contracts;
using EncounterLab.Application;

namespace EncounterLab.Api.GraphQL;

public sealed class Mutation
{
    public async Task<CombatResultPayload> ApplyDamage(
        DamageInput input,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        CombatResultPayload.From(await service.ApplyDamageAsync(
            new DamageCommand(
                input.CharacterId,
                input.CommandId,
                input.ExpectedVersion,
                input.Amount,
                input.DamageType),
            cancellationToken));

    public async Task<CombatResultPayload> HealCharacter(
        HealInput input,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        CombatResultPayload.From(await service.HealAsync(
            new HealCommand(
                input.CharacterId,
                input.CommandId,
                input.ExpectedVersion,
                input.Amount),
            cancellationToken));

    public async Task<CombatResultPayload> SetTemporaryHitPoints(
        TemporaryHitPointsInput input,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        CombatResultPayload.From(await service.SetTemporaryHitPointsAsync(
            new SetTemporaryHitPointsCommand(
                input.CharacterId,
                input.CommandId,
                input.ExpectedVersion,
                input.Amount),
            cancellationToken));

    public async Task<CombatResultPayload> ClearTemporaryHitPoints(
        ClearTemporaryHitPointsInput input,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        CombatResultPayload.From(await service.ClearTemporaryHitPointsAsync(
            new ClearTemporaryHitPointsCommand(
                input.CharacterId,
                input.CommandId,
                input.ExpectedVersion),
            cancellationToken));

    public async Task<CombatResultPayload> RollDice(
        DiceRollInput input,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        CombatResultPayload.From(await service.RollDiceAsync(
            new DiceRollCommand(
                input.CharacterId,
                input.CommandId,
                input.ExpectedVersion,
                input.Expression),
            cancellationToken));

    public async Task<CombatResultPayload> ResetEncounter(
        ResetEncounterInput input,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        CombatResultPayload.From(await service.ResetEncounterAsync(
            new ResetEncounterCommand(
                input.CharacterId,
                input.CommandId,
                input.ExpectedVersion),
            cancellationToken));
}
