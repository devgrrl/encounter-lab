using EncounterLab.Domain.Combat;

namespace EncounterLab.Infrastructure;

public interface ICharacterSeed
{
    CharacterState Create(int version = 0);
}
