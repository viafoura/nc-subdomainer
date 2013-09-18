var inFlight = false;
$(document).ready(function(){
    reloadHosts();

    // Add a new subdomain
    $("#addButton").click(function(evt){
        if (!inFlight){
            inFlight = true;
            $("#loadingRow").show();
            $.ajax({
                dataType: "json",
                type: "post",
                url: "/subdomain",
                data: $("#addForm").serialize(),
                success: function(res){
                    inFlight = false;
                    $("#loadingRow").hide();
                    alert(res.message);
                    reloadHosts();
                }
            });
        }
    });

    // Change placeholder on dropdown update
    $("#subdomaintype").change(function(evt){
        switch (evt.currentTarget.value){
            case "CNAME":
                $("#dest").attr("placeholder", "your_server.dyndns.org");
            break;
            case "A":
                $("#dest").attr("placeholder", "0.0.0.0");
            break;
            case "URL301":
                $("#dest").attr("placeholder", "http://redirect.example.com/");
            break;
            default:
                return false;
        }
    });
});

var reloadHosts = function(){
    $("#loadingRow").show();
    $(".generatedRow").remove();
    $.ajax({
        dataType: "json",
        url: "/subdomains",
        data: $("#addForm").serialize(),
        error: function(res){
            $("#loadingRow").html("Error: " + JSON.stringify(res));
        },
        success: function(res){
            $("#loadingRow").hide();
            for (var i = 0, resLen = res.length; resLen > i; i++){
                var records = res[i].DomainDNSGetHostsResult;
                for (var a = 0, hostLen = records.host.length; hostLen > a; a++){
                    if (records.host[a].Name !== "@" && records.host[a].Name !== "www"){
                        var rowOutput = "<tr class='generatedRow' data-hostid='" + records.HostId + "' data-owner=''><td><b>"+ records.host[a].Name +"</b>." + records.Domain + "</td>";
                        switch ( records.host[a].Type ){
                            case "CNAME":
                                rowOutput = rowOutput + "<td data-recordtype> to host ('CNAME' record)</td>";
                            break;
                            case "URL301":
                                rowOutput = rowOutput + "<td data-recordtype> complete redirect (HTTP 301)</td>";
                            break;
                            case "A":
                                rowOutput = rowOutput + "<td data-recordtype> to IP ('A' record)</td>";
                            break;
                            default:
                                rowOutput = rowOutput + "<td data-recordtype> special type ("+records.host[a].Type+") </td>";
                        }

                        rowOutput = rowOutput + "<td>" + records.host[a].Address + "</td>";
                        rowOutput = rowOutput + '<td><button type="button" class="btn btn-danger deleteButton" data-domain="' + records.Domain + '" data-subdomain="' + records.host[a].Name + '">Delete</button></td>';
                        $("#HolderTable tbody").append(rowOutput);
                    }
                }
            }
            
            $("#HolderTable").tablesorter();
            
            // Delete a new subdomain
            $(".deleteButton").click(function(evt){
                if (!inFlight){
                    $("#loadingRow").show();
                    inFlight = true;
                    var data = "subdomain=" + $(this).data("subdomain") + "&domain=" + $(this).data("domain");
                    $.ajax({
                        dataType: "json",
                        type: "delete",
                        url: "/subdomain",
                        "data": data,
                        success: function(res){
                            $("#loadingRow").hide();
                            inFlight = false;
                            console.log(res);
                            reloadHosts();
                        }
                    });
                }
            });
        }
    });
};