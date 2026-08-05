using System.Security.Cryptography;

namespace EncounterLab.Application;

public sealed class CryptoRandomSource : IRandomSource
{
    public int Next(int inclusiveMinimum, int exclusiveMaximum) =>
        RandomNumberGenerator.GetInt32(inclusiveMinimum, exclusiveMaximum);
}
