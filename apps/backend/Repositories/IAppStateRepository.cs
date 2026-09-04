internal interface IAppStateRepository
{
    Task InitializeAsync();

    Task<string> GetStateAsync();

    Task SetStateAsync(string state);
}