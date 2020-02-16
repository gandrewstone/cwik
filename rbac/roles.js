var adminList = require("./admins.json")["Admins"];
var memberList = require("./members.json")["Members"];
var permissions = require("./permissions.js");
var util = require("./util.js");

function enforce_prefix(addr)
{
    if (DebugEnabled())
    {
        if (addr.startsWith("bchreg:"))
        {
            return addr;
        }
        addr = "bchreg:" + addr;
        return addr;
    }
    /// NOT DEBUG
    if (addr.startsWith("bitcoincash:"))
    {
        return addr;
    }
    addr = "bitcoincash:" + addr;
    return addr;
}

function enforce_no_prefix(addr)
{
    if (DebugEnabled())
    {
        if (!addr.startsWith("bchreg:"))
        {
            return addr;
        }
        addr = addr.substr(7);
        return addr;
    }
    /// NOT DEBUG
    if (!addr.startsWith("bitcoincash:"))
    {
        return addr;
    }
    addr = addr.substr(12);
    return addr;
}

/// cashaddr prefix is optional for addr param
IsMember = function(addr)
{
    if (IsNullOrUndefined(addr))
    {
        return false;
    }
    addr_prefix = enforce_prefix(addr);
    for (i = 0; i < memberList.length; i++)
    {
        if (memberList[i] === addr_prefix)
        {
            return true;
        }
    }
    return false;
}

/// cashaddr prefix is optional for addr param
IsOwner = function(addr, pmd)
{
    if (IsNullOrUndefined(addr) || IsNullOrUndefined(pmd))
    {
        return false;
    }
    addr_prefix = enforce_prefix(addr);
    addr_no_prefix = enforce_no_prefix(addr);
    if (IsMember(addr) === false)
    {
        return false;
    }
    var owner = GetOwnerPMD(pmd);
    var check1 = (owner === addr_prefix);
    var check2 = (owner === addr_no_prefix);
    return (check1 || check2);
}

/// cashaddr prefix is optional for addr param
IsAdmin = function(addr)
{
    if (IsNullOrUndefined(addr))
    {
        return false;
    }
    addr_prefix = enforce_prefix(addr);
    for (i = 0; i < adminList.length; i++)
    {
        if (adminList[i] === addr_prefix)
        {
            return true;
        }
    }
    return false;
}

/// cashaddr prefix is optional for addr param
IsMemberOrAdmin = function(addr)
{
    if (IsNullOrUndefined(addr))
    {
        return false;
    }
    if (IsMember(addr))
    {
        return true;
    }
    else if (IsAdmin(addr))
    {
        return true;
    }
    return false;
}
