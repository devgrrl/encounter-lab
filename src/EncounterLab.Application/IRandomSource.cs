namespace EncounterLab.Application;

public interface IRandomSource
{
    int Next(int inclusiveMinimum, int exclusiveMaximum);
}
