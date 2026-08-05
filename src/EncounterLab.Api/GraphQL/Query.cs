using HotChocolate;
using EncounterLab.Api.Contracts;
using EncounterLab.Application;

namespace EncounterLab.Api.GraphQL;

public sealed class Query
{
    public async Task<EncounterPayload> GetEncounter(
        string characterId,
        [Service] CombatService service,
        CancellationToken cancellationToken) =>
        EncounterPayload.From(await service.GetEncounterAsync(characterId, cancellationToken));
}
