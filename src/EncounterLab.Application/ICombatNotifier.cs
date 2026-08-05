namespace EncounterLab.Application;

public interface ICombatNotifier
{
    Task PublishCommittedAsync(CombatResult result, CancellationToken cancellationToken);
}
