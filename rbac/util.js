IsNullOrUndefined = function(data)
{
    return ( (data == null) || (data == undefined) );
}

DebugEnabled = function()
{
    var debug = process.env.DEBUG;
    if (debug != true)
    {
        return false;
    }
    return true;
}
