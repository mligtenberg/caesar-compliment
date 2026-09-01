// Thrown when Microsoft Graph itself can't be reached or fails - as opposed to a
// plain "this user has no photo", which is a normal, expected outcome (404).
internal class GraphUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
