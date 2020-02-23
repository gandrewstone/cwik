var roles = require("./roles");
var util = require("./util.js");

/// Never used, just here for completeness
HasReadPermission = function(addr)
{
    return true;
}

HasWritePermission = function(addr)
{
    return IsMemberOrAdmin(addr);
}

HasEditPermission = function(addr, postdata)
{
    if (IsAdmin(addr))
    {
        return true;
    }
    else if (IsOwner(addr, postdata))
    {
        return true;
    }
    return false;
}

HasFreezePermission = function(addr)
{
    return IsAdmin(addr);
}

/// PMD = Permission Metadata

function GenerateDefaultPMD()
{
    return {"Owner": null, "Freeze": false, "AdminOnly": false};
}

GeneratePMD = function(author)
{
    var dPMD = GenerateDefaultPMD();
    dPMD["Owner"] = author;
    return dPMD;
}

GetOwnerPMD = function(pmd)
{
    if (IsNullOrUndefined(pmd))
    {
        // returns the default value
        return null;
    }
    return pmd["Owner"];
}

EditOwnerPMD = function(pmd, newOwner)
{
    if (IsNullOrUndefined(pmd))
    {
        return;
    }
    pmd["Owner"] = newOwner;
}

ToggleFreezePMD = function(pmd)
{
    if (IsNullOrUndefined(pmd))
    {
        // returns the default value
        return false;
    }
    pmd["Freeze"] = !pmd["Freeze"];
}

IsThreadFrozen = function(user, pmd)
{
    if (IsNullOrUndefined(pmd))
    {
        // returns the default value
        return false;
    }
    if (IsAdmin(user))
    {
        return false;
    }
    return pmd["Freeze"];
}

SetAdminOnlyPMD = function(pmd, newValue)
{
    if (IsNullOrUndefined(pmd))
    {
        // returns the default value
        return false;
    }
    pmd["AdminOnly"] = newValue;
}
