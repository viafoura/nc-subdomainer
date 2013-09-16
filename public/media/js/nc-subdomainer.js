$(document).ready(function(){
    reloadHosts();

    $("#addButton").click(function(evt){
        $.ajax({
            dataType: "json",
            type: "post",
            url: "/subdomain",
            data: $("#addForm").serialize(),
            success: function(res){
                console.log(res);
            }
        });
    });
});

var reloadHosts = function(){
    $("#loadingRow").show();
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
                        var rowOutput = "<tr data-hostid='" + records.HostId + "' data-owner=''><td><b>"+ records.host[a].Name +"</b>." + records.Domain + "</td>";
                        switch ( records.host[a].Type ){
                            case "URL":
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
                        rowOutput = rowOutput + '<td><button type="button" class="btn btn-danger deleteButton">Delete</button></td>';
                        $("#HolderTable").append(rowOutput);
                    }
                }
            }

            // Finally, add the new subdomain row
            $("#HolderTable").append( $("#newRowHolder table").html() );

        }
    });
};